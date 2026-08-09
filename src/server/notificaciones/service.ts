import { Prisma, type CanalNotificacion, type EstadoNotificacion, type EventoNotificacion } from "@prisma/client";
import type { TenantTx } from "../db/with-tenant";
import { withTenant } from "../db/with-tenant";
import { conSavepoint } from "../db/savepoint";
import { writeAudit } from "../audit/log";
import { getEffectivePermissions } from "../rbac/effective-permissions";
import { requirePermission, ForbiddenError } from "../rbac/permissions";
import { paginationArgs, toPaginatedResult, type PaginationParams } from "../db/pagination";
import type { TenantActor } from "../clientes/service";
import { getCanalSender } from "./channels";

const RECURSO = "NOTIFICACIONES" as const;

export class NotificacionNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró la notificación ${id}`);
    this.name = "NotificacionNotFoundError";
  }
}

export class TransicionNotificacionInvalidaError extends Error {
  constructor(desde: EstadoNotificacion, hacia: string) {
    super(`No se puede pasar de ${desde} a ${hacia}`);
    this.name = "TransicionNotificacionInvalidaError";
  }
}

const ANTICIPACION_VENCIMIENTO_DIAS = 30;
const ANTICIPACION_MANTENIMIENTO_DIAS = 7;

export interface GenerarNotificacionParams {
  tenantId: string;
  evento: EventoNotificacion;
  canal: CanalNotificacion;
  canalAlternativo?: CanalNotificacion;
  destinatarioNombre?: string | null;
  destinatarioEmail?: string | null;
  destinatarioWhatsapp?: string | null;
  clienteId?: string;
  usuarioId?: string;
  entidadTipo: string;
  entidadId: string;
  plantilla: string;
  payload?: Record<string, unknown>;
  programadaPara?: Date;
}

function construirClaveDedup(params: GenerarNotificacionParams, fecha: Date): string {
  const destino = params.destinatarioEmail ?? params.destinatarioWhatsapp ?? params.usuarioId ?? params.clienteId ?? "sin-destinatario";
  const dia = fecha.toISOString().slice(0, 10);
  return `${params.evento}:${params.entidadTipo}:${params.entidadId}:${destino}:${dia}`;
}

/**
 * Punto de entrada para que cualquier otro módulo dispare una notificación
 * dentro de su propia transacción (mismo patrón que writeAudit): no hace
 * chequeo de RBAC porque no lo origina un actor humano, sino un evento de
 * dominio (certificado emitido, unidad retirada, etc.).
 *
 * "Dada una notificación ya enviada para el mismo evento, cuando se vuelve a
 * procesar, se evita el duplicado" (RF-19): `claveDedup` incluye el día, así
 * que reintentar el mismo evento sobre la misma entidad/destinatario el
 * mismo día choca contra el índice único (tenantId, claveDedup) y esta
 * función devuelve `null` en silencio en vez de lanzar.
 */
export async function generarNotificacion(tx: TenantTx, params: GenerarNotificacionParams) {
  const programadaPara = params.programadaPara ?? new Date();
  const claveDedup = construirClaveDedup(params, programadaPara);

  try {
    // Envuelto en SAVEPOINT (ver src/server/db/savepoint.ts): esta función se
    // llama repetidas veces dentro de una misma transacción más larga (ej. el
    // escaneo de vencimientos), así que un P2002 de dedup no puede dejar el
    // resto de esa transacción "aborted" en Postgres.
    return await conSavepoint(tx, () =>
      tx.notificacion.create({
        data: {
          tenantId: params.tenantId,
          evento: params.evento,
          canal: params.canal,
          ...(params.canalAlternativo ? { canalAlternativo: params.canalAlternativo } : {}),
          ...(params.destinatarioNombre ? { destinatarioNombre: params.destinatarioNombre } : {}),
          ...(params.destinatarioEmail ? { destinatarioEmail: params.destinatarioEmail } : {}),
          ...(params.destinatarioWhatsapp ? { destinatarioWhatsapp: params.destinatarioWhatsapp } : {}),
          ...(params.clienteId ? { clienteId: params.clienteId } : {}),
          ...(params.usuarioId ? { usuarioId: params.usuarioId } : {}),
          entidadTipo: params.entidadTipo,
          entidadId: params.entidadId,
          plantilla: params.plantilla,
          ...(params.payload ? { payload: params.payload as Prisma.InputJsonValue } : {}),
          claveDedup,
          programadaPara,
        },
      }),
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null;
    throw err;
  }
}

async function intentarEnviar(tx: TenantTx, notificacion: { id: string; canal: CanalNotificacion; canalAlternativo: CanalNotificacion | null; destinatarioEmail: string | null; destinatarioWhatsapp: string | null; plantilla: string; payload: Prisma.JsonValue; intentos: number; maxIntentos: number }) {
  await tx.notificacion.update({ where: { id: notificacion.id }, data: { estado: "EN_PROCESO", intentos: { increment: 1 } } });

  const envio = {
    destinatarioEmail: notificacion.destinatarioEmail,
    destinatarioWhatsapp: notificacion.destinatarioWhatsapp,
    plantilla: notificacion.plantilla,
    payload: notificacion.payload as Record<string, unknown> | null,
  };

  let resultado = await getCanalSender(notificacion.canal).enviar(envio);
  let canalUsado = notificacion.canal;

  // "Dado un canal fallido, cuando existe un canal alternativo, el sistema
  // ejecuta el fallback" (RF-19): se intenta en la misma pasada, no en una
  // pasada de reintento separada.
  if (!resultado.ok && notificacion.canalAlternativo) {
    resultado = await getCanalSender(notificacion.canalAlternativo).enviar(envio);
    canalUsado = notificacion.canalAlternativo;
  }

  if (resultado.ok) {
    const actualizada = await tx.notificacion.update({
      where: { id: notificacion.id },
      data: {
        estado: "ENVIADA",
        enviadaEn: new Date(),
        ...(canalUsado !== notificacion.canal ? { errorDetalle: `Canal primario falló; enviado por ${canalUsado} (fallback)` } : {}),
      },
    });
    return { estado: "ENVIADA" as const, notificacion: actualizada };
  }

  const intentos = notificacion.intentos + 1;
  const estadoFinal: "FALLIDA" | "REINTENTO" = intentos >= notificacion.maxIntentos ? "FALLIDA" : "REINTENTO";
  const actualizada = await tx.notificacion.update({
    where: { id: notificacion.id },
    data: { estado: estadoFinal, errorDetalle: resultado.error },
  });
  return { estado: estadoFinal, notificacion: actualizada };
}

/**
 * Procesa la cola de notificaciones pendientes. Pensado para ser invocado
 * por un job periódico (cron externo — Vercel Cron, GitHub Actions
 * schedule, etc., a definir en el despliegue) o manualmente por un admin
 * mientras no exista esa infraestructura. Reservado a alcance TODAS: no hay
 * una acción de permiso dedicada para "procesar" en el catálogo, así que se
 * reutiliza VER (igual que escanearVencimientosYGenerarNotificaciones).
 */
export async function procesarNotificacionesPendientes(actor: TenantActor, ahora: Date = new Date()) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "VER");

    const pendientes = await tx.notificacion.findMany({
      where: { estado: { in: ["PENDIENTE", "REINTENTO"] }, programadaPara: { lte: ahora } },
    });

    let enviadas = 0;
    let fallidas = 0;
    for (const notificacion of pendientes) {
      const resultado = await intentarEnviar(tx, notificacion);
      if (resultado.estado === "ENVIADA") enviadas++;
      else if (resultado.estado === "FALLIDA") fallidas++;
    }

    return { procesadas: pendientes.length, enviadas, fallidas };
  });
}

function canalYAlternativoPara(cliente: { canalPreferido: CanalNotificacion }): { canal: CanalNotificacion; canalAlternativo: CanalNotificacion } {
  const canal: CanalNotificacion = cliente.canalPreferido === "WHATSAPP" ? "WHATSAPP" : "EMAIL";
  const canalAlternativo: CanalNotificacion = canal === "EMAIL" ? "WHATSAPP" : "EMAIL";
  return { canal, canalAlternativo };
}

/**
 * "Dada una unidad que vence según una regla configurada, cuando llega la
 * fecha de aviso, se genera la notificación" (RF-19): escanea matafuegos y
 * mantenimientos programados próximos a vencer/vencidos y genera una
 * notificación por cada uno (el dedup por día evita repetir el mismo aviso
 * en cada corrida). La anticipación es fija (30 días para vencimientos, 7
 * para mantenimientos) — RF-19 prevé que sea configurable por regla, pero
 * ese nivel de configuración queda para una iteración posterior; acá se usa
 * un valor por defecto razonable en vez de bloquear el resto del motor.
 */
export async function escanearVencimientosYGenerarNotificaciones(actor: TenantActor, ahora: Date = new Date()) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "VER");

    let generadas = 0;
    const limiteVencimiento = new Date(ahora.getTime() + ANTICIPACION_VENCIMIENTO_DIAS * 86_400_000);
    const limiteMantenimiento = new Date(ahora.getTime() + ANTICIPACION_MANTENIMIENTO_DIAS * 86_400_000);

    const vencidos = await tx.matafuego.findMany({ where: { estado: "VENCIDO" }, include: { cliente: true } });
    for (const m of vencidos) {
      const { canal, canalAlternativo } = canalYAlternativoPara(m.cliente);
      const resultado = await generarNotificacion(tx, {
        tenantId: actor.tenantId,
        evento: "MATAFUEGO_VENCIDO",
        canal,
        canalAlternativo,
        clienteId: m.clienteId,
        destinatarioNombre: m.cliente.razonSocial ?? m.cliente.nombre,
        destinatarioEmail: m.cliente.email,
        destinatarioWhatsapp: m.cliente.whatsapp,
        entidadTipo: "Matafuego",
        entidadId: m.id,
        plantilla: "matafuego_vencido",
        payload: { codigoInterno: m.codigoInterno },
        programadaPara: ahora,
      });
      if (resultado) generadas++;
    }

    const proximosAVencer = await tx.matafuego.findMany({
      where: {
        estado: { not: "VENCIDO" },
        OR: [{ proximaInspeccion: { gte: ahora, lte: limiteVencimiento } }, { proximaRecarga: { gte: ahora, lte: limiteVencimiento } }],
      },
      include: { cliente: true },
    });
    for (const m of proximosAVencer) {
      const { canal, canalAlternativo } = canalYAlternativoPara(m.cliente);
      const resultado = await generarNotificacion(tx, {
        tenantId: actor.tenantId,
        evento: "VENCIMIENTO_PROXIMO",
        canal,
        canalAlternativo,
        clienteId: m.clienteId,
        destinatarioNombre: m.cliente.razonSocial ?? m.cliente.nombre,
        destinatarioEmail: m.cliente.email,
        destinatarioWhatsapp: m.cliente.whatsapp,
        entidadTipo: "Matafuego",
        entidadId: m.id,
        plantilla: "vencimiento_proximo",
        payload: { codigoInterno: m.codigoInterno },
        programadaPara: ahora,
      });
      if (resultado) generadas++;
    }

    const pruebaHidraulicaProxima = await tx.matafuego.findMany({
      where: { proximaPruebaHidraulica: { gte: ahora, lte: limiteVencimiento } },
      include: { cliente: true },
    });
    for (const m of pruebaHidraulicaProxima) {
      const { canal, canalAlternativo } = canalYAlternativoPara(m.cliente);
      const resultado = await generarNotificacion(tx, {
        tenantId: actor.tenantId,
        evento: "PRUEBA_HIDRAULICA_PROXIMA",
        canal,
        canalAlternativo,
        clienteId: m.clienteId,
        destinatarioNombre: m.cliente.razonSocial ?? m.cliente.nombre,
        destinatarioEmail: m.cliente.email,
        destinatarioWhatsapp: m.cliente.whatsapp,
        entidadTipo: "Matafuego",
        entidadId: m.id,
        plantilla: "prueba_hidraulica_proxima",
        payload: { codigoInterno: m.codigoInterno },
        programadaPara: ahora,
      });
      if (resultado) generadas++;
    }

    const mantenimientos = await tx.mantenimientoProgramado.findMany({
      where: { estado: { in: ["PROGRAMADO", "REPROGRAMADO"] }, fechaProgramada: { lte: limiteMantenimiento } },
      include: { matafuego: { include: { cliente: true } } },
    });
    for (const mp of mantenimientos) {
      const evento: EventoNotificacion = mp.fechaProgramada.getTime() < ahora.getTime() ? "MANTENIMIENTO_ATRASADO" : "MANTENIMIENTO_PROXIMO";
      const cliente = mp.matafuego.cliente;
      const { canal, canalAlternativo } = canalYAlternativoPara(cliente);
      const resultado = await generarNotificacion(tx, {
        tenantId: actor.tenantId,
        evento,
        canal,
        canalAlternativo,
        clienteId: cliente.id,
        destinatarioNombre: cliente.razonSocial ?? cliente.nombre,
        destinatarioEmail: cliente.email,
        destinatarioWhatsapp: cliente.whatsapp,
        entidadTipo: "MantenimientoProgramado",
        entidadId: mp.id,
        plantilla: evento.toLowerCase(),
        payload: { tipoServicio: mp.tipoServicio, fechaProgramada: mp.fechaProgramada.toISOString() },
        programadaPara: ahora,
      });
      if (resultado) generadas++;
    }

    return { generadas };
  });
}

export async function listNotificaciones(actor: TenantActor, filtros: { estado?: EstadoNotificacion; evento?: EventoNotificacion } = {}) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const where = {
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.evento ? { evento: filtros.evento } : {}),
    };

    if (scope === "TODAS") {
      return tx.notificacion.findMany({ where, orderBy: { createdAt: "desc" } });
    }
    if (scope === "PROPIO") {
      return tx.notificacion.findMany({ where: { ...where, usuarioId: actor.usuarioId }, orderBy: { createdAt: "desc" } });
    }
    return [];
  });
}

export async function listNotificacionesPaginado(
  actor: TenantActor,
  filtros: { estado?: EstadoNotificacion; evento?: EventoNotificacion } & PaginationParams = {},
) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    const { page, pageSize, skip, take } = paginationArgs(filtros);

    if (scope !== "TODAS" && scope !== "PROPIO") {
      return toPaginatedResult([], 0, 1, pageSize);
    }

    const where = {
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.evento ? { evento: filtros.evento } : {}),
      ...(scope === "PROPIO" ? { usuarioId: actor.usuarioId } : {}),
    };

    const [items, total] = await Promise.all([
      tx.notificacion.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      tx.notificacion.count({ where }),
    ]);
    return toPaginatedResult(items, total, page, pageSize);
  });
}

export async function getNotificacion(actor: TenantActor, id: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const notificacion = await tx.notificacion.findUnique({ where: { id } });
    if (!notificacion) throw new NotificacionNotFoundError(id);

    if (scope === "TODAS") return notificacion;
    if (scope === "PROPIO" && notificacion.usuarioId === actor.usuarioId) return notificacion;
    return null;
  });
}

/** Autoservicio: marcar como leída una notificación propia (destinada al
 * actor), sin necesitar alcance TODAS. */
export async function marcarNotificacionLeida(actor: TenantActor, id: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const notificacion = await tx.notificacion.findUnique({ where: { id } });
    if (!notificacion) throw new NotificacionNotFoundError(id);
    if (scope !== "TODAS" && notificacion.usuarioId !== actor.usuarioId) {
      throw new ForbiddenError(RECURSO, "VER");
    }
    if (!["ENVIADA", "ENTREGADA"].includes(notificacion.estado)) {
      throw new TransicionNotificacionInvalidaError(notificacion.estado, "LEIDA");
    }

    return tx.notificacion.update({ where: { id }, data: { estado: "LEIDA", leidaEn: new Date() } });
  });
}

export async function cancelarNotificacion(actor: TenantActor, id: string, motivo?: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "VER");

    const notificacion = await tx.notificacion.findUnique({ where: { id } });
    if (!notificacion) throw new NotificacionNotFoundError(id);
    if (!["PENDIENTE", "REINTENTO"].includes(notificacion.estado)) {
      throw new TransicionNotificacionInvalidaError(notificacion.estado, "CANCELADA");
    }

    const actualizada = await tx.notificacion.update({ where: { id }, data: { estado: "CANCELADA" } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "Notificacion",
      entidadId: id,
      valorAnterior: { estado: notificacion.estado },
      valorNuevo: { estado: "CANCELADA" },
      motivo,
    });

    return actualizada;
  });
}

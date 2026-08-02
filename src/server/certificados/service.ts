import type { AlcancePermiso, EstadoCertificado, EstadoOrdenTrabajo, TipoCertificado } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { TenantTx } from "../db/with-tenant";
import { withTenant } from "../db/with-tenant";
import { conSavepoint } from "../db/savepoint";
import { writeAudit } from "../audit/log";
import { getEffectivePermissions } from "../rbac/effective-permissions";
import { requirePermission, ForbiddenError } from "../rbac/permissions";
import type { TenantActor } from "../clientes/service";
import { generateQrToken } from "../qr/token";
import { generarNotificacion } from "../notificaciones/service";
import { emitirCertificadoSchema, reemplazarCertificadoSchema, type EmitirCertificadoInput, type ReemplazarCertificadoInput } from "./schemas";

const RECURSO = "CERTIFICADOS" as const;

export class CertificadoNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el certificado ${id}`);
    this.name = "CertificadoNotFoundError";
  }
}

export class CertificadoQrNotFoundError extends Error {
  constructor() {
    super("Código QR de certificado no válido o no reconocido");
    this.name = "CertificadoQrNotFoundError";
  }
}

export class OrdenTrabajoAsociadaNotFoundError extends Error {
  constructor(ordenTrabajoId: string) {
    super(`La orden de trabajo ${ordenTrabajoId} no existe o no pertenece a esta empresa`);
    this.name = "OrdenTrabajoAsociadaNotFoundError";
  }
}

export class OrdenNoFinalizadaInvalidoError extends Error {
  constructor(estado: EstadoOrdenTrabajo) {
    super(`La orden está en estado ${estado}: sólo puede emitirse un certificado sobre una orden finalizada, entregada o facturada`);
    this.name = "OrdenNoFinalizadaInvalidoError";
  }
}

export class TecnicoResponsableInvalidoError extends Error {
  constructor(usuarioId: string) {
    super(`El usuario ${usuarioId} no existe o no pertenece a esta empresa`);
    this.name = "TecnicoResponsableInvalidoError";
  }
}

export class TransicionCertificadoInvalidaError extends Error {
  constructor(desde: EstadoCertificado, hacia: string) {
    super(`No se puede pasar de ${desde} a ${hacia}`);
    this.name = "TransicionCertificadoInvalidaError";
  }
}

export class MotivoAnulacionRequeridoInvalidoError extends Error {
  constructor() {
    super("Anular un certificado requiere indicar un motivo");
    this.name = "MotivoAnulacionRequeridoInvalidoError";
  }
}

const ESTADOS_ORDEN_QUE_HABILITAN_CERTIFICADO: EstadoOrdenTrabajo[] = ["FINALIZADA", "ENTREGADA", "FACTURADA"];

async function assertTecnicoPerteneceAlTenant(tx: TenantTx, usuarioId: string) {
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } });
  if (!usuario) throw new TecnicoResponsableInvalidoError(usuarioId);
}

/** TODAS siempre puede. PROPIO sólo si el actor figura como responsable
 * técnico del certificado — mismo criterio de alcance PROPIO usado en el
 * resto de los módulos (OrdenTrabajo, RetiroEntrega, NoConformidad). */
function puedeVer(scope: AlcancePermiso, certificado: { responsableTecnicoId: string | null }, actor: TenantActor): boolean {
  if (scope === "TODAS") return true;
  if (scope === "PROPIO") return certificado.responsableTecnicoId === actor.usuarioId;
  return false;
}

/** Ver comentario en el enum EstadoCertificado (schema.prisma): VIGENTE se
 * calcula acá en vez de ser una transición de estado almacenada, para no
 * depender de un job en background que la actualice al vencer. */
export function estaVigente(certificado: { estado: EstadoCertificado; vigenciaHasta: Date | null }): boolean {
  if (certificado.estado !== "EMITIDO") return false;
  if (!certificado.vigenciaHasta) return true;
  return certificado.vigenciaHasta.getTime() > Date.now();
}

async function siguienteNumero(tx: TenantTx): Promise<number> {
  const resultado = await tx.certificado.aggregate({ _max: { numero: true } });
  return (resultado._max.numero ?? 0) + 1;
}

/** Ver comentario equivalente en ordenes-trabajo/service.ts: el reintento va
 * envuelto en un SAVEPOINT porque sin eso, el P2002 deja el resto de la
 * transacción "aborted" en Postgres y el segundo intento fallaría igual. */
async function crearConNumeroCorrelativo(tx: TenantTx, data: Omit<Prisma.CertificadoUncheckedCreateInput, "numero">) {
  for (let intento = 0; intento < 5; intento++) {
    const numero = await siguienteNumero(tx);
    try {
      return await conSavepoint(tx, () => tx.certificado.create({ data: { ...data, numero } }));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("No se pudo asignar un número de certificado tras varios intentos");
}

export async function listCertificados(
  actor: TenantActor,
  filtros: { estado?: EstadoCertificado; clienteId?: string; tipo?: TipoCertificado } = {},
) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const where = {
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
    };

    if (scope === "TODAS") {
      return tx.certificado.findMany({ where, orderBy: { numero: "desc" }, include: { unidades: true } });
    }
    if (scope === "PROPIO") {
      return tx.certificado.findMany({
        where: { ...where, responsableTecnicoId: actor.usuarioId },
        orderBy: { numero: "desc" },
        include: { unidades: true },
      });
    }
    return [];
  });
}

export async function getCertificado(actor: TenantActor, id: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const certificado = await tx.certificado.findUnique({ where: { id }, include: { unidades: true } });
    if (!certificado) throw new CertificadoNotFoundError(id);

    if (!puedeVer(scope, certificado, actor)) return null;
    return certificado;
  });
}

/**
 * "Dada una orden finalizada, cuando se emite un certificado, queda asociado
 * a la orden y las unidades" (RF-17): copia cliente/establecimiento/unidades/
 * servicios de la orden en vez de pedírselos de nuevo, y los deja fijos en el
 * certificado (snapshot) — no se recalculan si la orden cambia después.
 *
 * Es la única función de alta: un certificado con valor legal se crea ya
 * emitido, no como un borrador editable (ver comentario en el enum
 * EstadoCertificado).
 */
export async function emitirCertificado(actor: TenantActor, rawInput: EmitirCertificadoInput) {
  const input = emitirCertificadoSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EMITIR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "EMITIR");

    const orden = await tx.ordenTrabajo.findUnique({ where: { id: input.ordenTrabajoId }, include: { items: true, unidades: true } });
    if (!orden) throw new OrdenTrabajoAsociadaNotFoundError(input.ordenTrabajoId);
    if (!ESTADOS_ORDEN_QUE_HABILITAN_CERTIFICADO.includes(orden.estado)) {
      throw new OrdenNoFinalizadaInvalidoError(orden.estado);
    }

    if (input.responsableTecnicoId) {
      await assertTecnicoPerteneceAlTenant(tx, input.responsableTecnicoId);
    }

    const certificado = await crearConNumeroCorrelativo(tx, {
      tenantId: actor.tenantId,
      clienteId: orden.clienteId,
      ...(orden.establecimientoId ? { establecimientoId: orden.establecimientoId } : {}),
      ordenTrabajoId: orden.id,
      tipo: input.tipo,
      serviciosRealizados: orden.items.map((item) => item.descripcion),
      ...(input.responsableTecnicoId ? { responsableTecnicoId: input.responsableTecnicoId } : {}),
      ...(input.responsableTecnicoNombre ? { responsableTecnicoNombre: input.responsableTecnicoNombre } : {}),
      ...(input.firmaResponsableNombre ? { firmaResponsableNombre: input.firmaResponsableNombre } : {}),
      ...(input.vigenciaHasta ? { vigenciaHasta: input.vigenciaHasta } : {}),
      ...(input.observaciones ? { observaciones: input.observaciones } : {}),
      qrToken: generateQrToken(),
      estado: "EMITIDO",
    });

    if (orden.unidades.length > 0) {
      await tx.certificadoUnidad.createMany({
        data: orden.unidades.map((u) => ({ tenantId: actor.tenantId, certificadoId: certificado.id, matafuegoId: u.matafuegoId })),
      });
    }

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "CREATE",
      entidad: "Certificado",
      entidadId: certificado.id,
      valorNuevo: certificado,
    });

    const cliente = await tx.cliente.findUnique({ where: { id: orden.clienteId } });
    if (cliente) {
      const canal = cliente.canalPreferido === "WHATSAPP" ? "WHATSAPP" : "EMAIL";
      await generarNotificacion(tx, {
        tenantId: actor.tenantId,
        evento: "CERTIFICADO_EMITIDO",
        canal,
        canalAlternativo: canal === "EMAIL" ? "WHATSAPP" : "EMAIL",
        clienteId: cliente.id,
        destinatarioNombre: cliente.razonSocial ?? cliente.nombre,
        destinatarioEmail: cliente.email,
        destinatarioWhatsapp: cliente.whatsapp,
        entidadTipo: "Certificado",
        entidadId: certificado.id,
        plantilla: "certificado_emitido",
        payload: { numero: certificado.numero, tipo: certificado.tipo },
      });
    }

    return tx.certificado.findUniqueOrThrow({ where: { id: certificado.id }, include: { unidades: true } });
  });
}

export async function anularCertificado(actor: TenantActor, id: string, motivo: string) {
  if (!motivo || !motivo.trim()) throw new MotivoAnulacionRequeridoInvalidoError();

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EMITIR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "EMITIR");

    const certificado = await tx.certificado.findUnique({ where: { id } });
    if (!certificado) throw new CertificadoNotFoundError(id);
    if (certificado.estado !== "EMITIDO") throw new TransicionCertificadoInvalidaError(certificado.estado, "ANULADO");

    const actualizado = await tx.certificado.update({ where: { id }, data: { estado: "ANULADO", motivoAnulacion: motivo } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "Certificado",
      entidadId: id,
      valorAnterior: { estado: certificado.estado },
      valorNuevo: { estado: "ANULADO" },
      motivo,
    });

    return actualizado;
  });
}

/**
 * "Dado un certificado emitido, cuando se modifica información crítica, se
 * genera una nueva versión o documento de reemplazo" (RF-17): el certificado
 * viejo pasa a REEMPLAZADO (nunca se edita en el lugar) y se emite uno nuevo,
 * con su propio número y QR, encadenado vía `reemplazaAId`.
 */
export async function reemplazarCertificado(actor: TenantActor, id: string, rawInput: ReemplazarCertificadoInput) {
  const input = reemplazarCertificadoSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EMITIR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "EMITIR");

    const anterior = await tx.certificado.findUnique({ where: { id } });
    if (!anterior) throw new CertificadoNotFoundError(id);
    if (anterior.estado !== "EMITIDO") throw new TransicionCertificadoInvalidaError(anterior.estado, "REEMPLAZADO");

    const responsableTecnicoId = input.responsableTecnicoId ?? anterior.responsableTecnicoId ?? undefined;
    if (responsableTecnicoId) {
      await assertTecnicoPerteneceAlTenant(tx, responsableTecnicoId);
    }

    const unidadesAnteriores = await tx.certificadoUnidad.findMany({ where: { certificadoId: anterior.id } });

    const nuevo = await crearConNumeroCorrelativo(tx, {
      tenantId: actor.tenantId,
      clienteId: anterior.clienteId,
      ...(anterior.establecimientoId ? { establecimientoId: anterior.establecimientoId } : {}),
      ordenTrabajoId: anterior.ordenTrabajoId,
      tipo: anterior.tipo,
      serviciosRealizados: anterior.serviciosRealizados,
      ...(responsableTecnicoId ? { responsableTecnicoId } : {}),
      responsableTecnicoNombre: input.responsableTecnicoNombre ?? anterior.responsableTecnicoNombre,
      firmaResponsableNombre: input.firmaResponsableNombre ?? anterior.firmaResponsableNombre,
      vigenciaHasta: input.vigenciaHasta ?? anterior.vigenciaHasta,
      observaciones: input.observaciones ?? anterior.observaciones,
      qrToken: generateQrToken(),
      version: anterior.version + 1,
      reemplazaAId: anterior.id,
      estado: "EMITIDO",
    });

    if (unidadesAnteriores.length > 0) {
      await tx.certificadoUnidad.createMany({
        data: unidadesAnteriores.map((u) => ({ tenantId: actor.tenantId, certificadoId: nuevo.id, matafuegoId: u.matafuegoId })),
      });
    }

    const anteriorActualizado = await tx.certificado.update({
      where: { id: anterior.id },
      data: { estado: "REEMPLAZADO", motivoReemplazo: input.motivo },
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "Certificado",
      entidadId: anterior.id,
      valorAnterior: { estado: anterior.estado },
      valorNuevo: { estado: "REEMPLAZADO", reemplazadoPorId: nuevo.id },
      motivo: input.motivo,
    });
    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "CREATE",
      entidad: "Certificado",
      entidadId: nuevo.id,
      valorAnterior: { reemplazaAId: anterior.id },
      valorNuevo: nuevo,
      motivo: input.motivo,
    });

    return {
      anterior: anteriorActualizado,
      nuevo: await tx.certificado.findUniqueOrThrow({ where: { id: nuevo.id }, include: { unidades: true } }),
    };
  });
}

export interface CertificadoPublicView {
  numero: number;
  tipo: TipoCertificado;
  estado: EstadoCertificado;
  fecha: Date;
  vigenciaHasta: Date | null;
  vigente: boolean;
  version: number;
}

/** "Dado un certificado anulado, cuando se consulta mediante QR, se informa
 * su estado" (RF-17): siempre responde con el estado real, sin ocultar
 * ANULADO/REEMPLAZADO — es precisamente lo que este endpoint público existe
 * para comunicar. Nunca expone cliente, establecimiento ni datos comerciales
 * (mismo criterio que resolveQrPublico de matafuegos, RF-05). */
export async function resolverCertificadoPublico(qrToken: string): Promise<CertificadoPublicView> {
  const certificado = await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
    tx.certificado.findUnique({
      where: { qrToken },
      select: { numero: true, tipo: true, estado: true, fecha: true, vigenciaHasta: true, version: true },
    }),
  );

  if (!certificado) throw new CertificadoQrNotFoundError();

  return { ...certificado, vigente: estaVigente(certificado) };
}

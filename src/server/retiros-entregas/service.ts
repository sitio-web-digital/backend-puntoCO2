import type { AlcancePermiso, EstadoMatafuego, EstadoRetiroEntrega } from "@prisma/client";
import type { TenantTx } from "../db/with-tenant";
import { withTenant } from "../db/with-tenant";
import { writeAudit } from "../audit/log";
import { getEffectivePermissions } from "../rbac/effective-permissions";
import { requirePermission, ForbiddenError } from "../rbac/permissions";
import { paginationArgs, toPaginatedResult, type PaginationParams } from "../db/pagination";
import type { TenantActor } from "../clientes/service";
import { generarNotificacion } from "../notificaciones/service";
import {
  registrarRetiroSchema,
  ingresarATallerSchema,
  actualizarUbicacionInternaSchema,
  registrarEntregaSchema,
  type RegistrarRetiroInput,
  type IngresarATallerInput,
  type ActualizarUbicacionInternaInput,
  type RegistrarEntregaInput,
} from "./schemas";

const RECURSO = "RETIROS_ENTREGAS" as const;

export class RetiroEntregaNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el registro de retiro/entrega ${id}`);
    this.name = "RetiroEntregaNotFoundError";
  }
}

export class MatafuegoAsociadoNotFoundError extends Error {
  constructor(matafuegoId: string) {
    super(`El matafuego ${matafuegoId} no existe o no pertenece a esta empresa`);
    this.name = "MatafuegoAsociadoNotFoundError";
  }
}

export class OrdenTrabajoAsociadaNotFoundError extends Error {
  constructor(ordenTrabajoId: string) {
    super(`La orden de trabajo ${ordenTrabajoId} no existe o no pertenece a esta empresa`);
    this.name = "OrdenTrabajoAsociadaNotFoundError";
  }
}

export class TecnicoResponsableInvalidoError extends Error {
  constructor(usuarioId: string) {
    super(`El usuario ${usuarioId} no existe o no pertenece a esta empresa`);
    this.name = "TecnicoResponsableInvalidoError";
  }
}

export class MatafuegoNoRetirableInvalidoError extends Error {
  constructor(estado: EstadoMatafuego) {
    super(`La unidad está en estado ${estado} y no admite registrar un retiro`);
    this.name = "MatafuegoNoRetirableInvalidoError";
  }
}

export class TransicionRetiroEntregaInvalidaError extends Error {
  constructor(desde: EstadoRetiroEntrega, hacia: string) {
    super(`No se puede pasar de ${desde} a ${hacia}`);
    this.name = "TransicionRetiroEntregaInvalidaError";
  }
}

export class MotivoCancelacionRequeridoInvalidoError extends Error {
  constructor() {
    super("Cancelar un retiro/entrega requiere indicar un motivo");
    this.name = "MotivoCancelacionRequeridoInvalidoError";
  }
}

/** Desde qué estados de la unidad tiene sentido registrar un retiro: no si ya
 * está en algún punto del propio ciclo de custodia (RETIRADO/EN_TRASLADO/
 * EN_TALLER/ENTREGADO) ni si está de baja/extraviada. */
const ESTADOS_MATAFUEGO_RETIRABLES: EstadoMatafuego[] = [
  "INSTALADO",
  "PENDIENTE_DE_CONTROL",
  "APTO",
  "OBSERVADO",
  "VENCIDO",
  "RECHAZADO",
  "FUERA_DE_SERVICIO",
];

async function assertMatafuegoPerteneceAlTenant(tx: TenantTx, matafuegoId: string) {
  const matafuego = await tx.matafuego.findUnique({ where: { id: matafuegoId } });
  if (!matafuego) throw new MatafuegoAsociadoNotFoundError(matafuegoId);
  return matafuego;
}

async function assertOrdenTrabajoPerteneceAlTenant(tx: TenantTx, ordenTrabajoId: string) {
  const orden = await tx.ordenTrabajo.findUnique({ where: { id: ordenTrabajoId }, select: { id: true } });
  if (!orden) throw new OrdenTrabajoAsociadaNotFoundError(ordenTrabajoId);
}

async function assertTecnicoPerteneceAlTenant(tx: TenantTx, usuarioId: string) {
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } });
  if (!usuario) throw new TecnicoResponsableInvalidoError(usuarioId);
}

/** TODAS siempre puede. PROPIO sólo si el actor es quien tiene la custodia
 * actual (tecnicoResponsableId) — coherente con el criterio ya usado en
 * OrdenTrabajo/NoConformidad para EDITAR:PROPIO. */
function puedeEditar(scope: AlcancePermiso, registro: { tecnicoResponsableId: string | null }, actor: TenantActor): boolean {
  if (scope === "TODAS") return true;
  if (scope === "PROPIO") return registro.tecnicoResponsableId === actor.usuarioId;
  return false;
}

export async function listRetirosEntregas(
  actor: TenantActor,
  filtros: { estado?: EstadoRetiroEntrega; matafuegoId?: string } = {},
) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const where = {
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.matafuegoId ? { matafuegoId: filtros.matafuegoId } : {}),
    };

    if (scope === "TODAS") {
      return tx.retiroEntrega.findMany({ where, orderBy: { createdAt: "desc" } });
    }
    if (scope === "PROPIO") {
      return tx.retiroEntrega.findMany({ where: { ...where, tecnicoResponsableId: actor.usuarioId }, orderBy: { createdAt: "desc" } });
    }
    return [];
  });
}

export async function listRetirosEntregasPaginado(
  actor: TenantActor,
  filtros: { estado?: EstadoRetiroEntrega; matafuegoId?: string } & PaginationParams = {},
) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const filtrosBase = {
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.matafuegoId ? { matafuegoId: filtros.matafuegoId } : {}),
    };

    if (scope !== "TODAS" && scope !== "PROPIO") {
      return toPaginatedResult([], 0, 1, paginationArgs(filtros).pageSize);
    }

    const where = scope === "PROPIO" ? { ...filtrosBase, tecnicoResponsableId: actor.usuarioId } : filtrosBase;

    const { page, pageSize, skip, take } = paginationArgs(filtros);
    const [items, total] = await Promise.all([
      tx.retiroEntrega.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      tx.retiroEntrega.count({ where }),
    ]);
    return toPaginatedResult(items, total, page, pageSize);
  });
}

export async function getRetiroEntrega(actor: TenantActor, id: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const registro = await tx.retiroEntrega.findUnique({ where: { id } });
    if (!registro) throw new RetiroEntregaNotFoundError(id);

    if (scope === "TODAS") return registro;
    if (scope === "PROPIO" && registro.tecnicoResponsableId === actor.usuarioId) return registro;
    return null;
  });
}

/**
 * RF-12: "dada una unidad instalada, cuando se registra su retiro, cambia a
 * RETIRADO o EN_TRASLADO" — directo a EN_TRASLADO si ya se conoce el destino
 * del traslado, o RETIRADO (retirada pero aún sin salir) en caso contrario.
 */
export async function registrarRetiro(actor: TenantActor, rawInput: RegistrarRetiroInput) {
  const input = registrarRetiroSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "CREAR");

    let tecnicoResponsableId = input.tecnicoResponsableId;
    if (scope !== "TODAS") {
      if (tecnicoResponsableId && tecnicoResponsableId !== actor.usuarioId) {
        throw new ForbiddenError(RECURSO, "CREAR");
      }
      tecnicoResponsableId = actor.usuarioId;
    }
    if (tecnicoResponsableId) {
      await assertTecnicoPerteneceAlTenant(tx, tecnicoResponsableId);
    }

    const matafuego = await assertMatafuegoPerteneceAlTenant(tx, input.matafuegoId);
    if (!ESTADOS_MATAFUEGO_RETIRABLES.includes(matafuego.estado)) {
      throw new MatafuegoNoRetirableInvalidoError(matafuego.estado);
    }
    if (input.ordenTrabajoId) {
      await assertOrdenTrabajoPerteneceAlTenant(tx, input.ordenTrabajoId);
    }

    const estadoInicial: EstadoRetiroEntrega = input.destino ? "EN_TRASLADO" : "RETIRADO";

    const registro = await tx.retiroEntrega.create({
      data: {
        tenantId: actor.tenantId,
        matafuegoId: input.matafuegoId,
        ...(input.ordenTrabajoId ? { ordenTrabajoId: input.ordenTrabajoId } : {}),
        ...(tecnicoResponsableId ? { tecnicoResponsableId } : {}),
        ...(input.personaQueEntrega ? { personaQueEntrega: input.personaQueEntrega } : {}),
        ...(input.personaQueRetira ? { personaQueRetira: input.personaQueRetira } : {}),
        ...(input.vehiculo ? { vehiculo: input.vehiculo } : {}),
        ...(input.destino ? { destino: input.destino } : {}),
        ...(input.estadoUnidadRetiro ? { estadoUnidadRetiro: input.estadoUnidadRetiro } : {}),
        ...(input.observaciones ? { observaciones: input.observaciones } : {}),
        fechaHoraRetiro: new Date(),
        estado: estadoInicial,
      },
    });

    await tx.matafuego.update({ where: { id: matafuego.id }, data: { estado: estadoInicial } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "CREATE",
      entidad: "RetiroEntrega",
      entidadId: registro.id,
      valorNuevo: registro,
    });

    const cliente = await tx.cliente.findUnique({ where: { id: matafuego.clienteId } });
    if (cliente) {
      const canal = cliente.canalPreferido === "WHATSAPP" ? "WHATSAPP" : "EMAIL";
      await generarNotificacion(tx, {
        tenantId: actor.tenantId,
        evento: "UNIDAD_RETIRADA",
        canal,
        canalAlternativo: canal === "EMAIL" ? "WHATSAPP" : "EMAIL",
        clienteId: cliente.id,
        destinatarioNombre: cliente.razonSocial ?? cliente.nombre,
        destinatarioEmail: cliente.email,
        destinatarioWhatsapp: cliente.whatsapp,
        entidadTipo: "RetiroEntrega",
        entidadId: registro.id,
        plantilla: "unidad_retirada",
        payload: { codigoInterno: matafuego.codigoInterno },
      });
    }

    return registro;
  });
}

/** No requiere ser ya el responsable de custodia: cualquiera con permiso de
 * EDITAR (TODAS o PROPIO) puede recibir un ingreso al taller — es la propia
 * recepción la que transfiere la custodia (quien la recibe pasa a ser el
 * nuevo `tecnicoResponsableId`), no al revés. */
export async function ingresarATaller(actor: TenantActor, id: string, rawInput: IngresarATallerInput) {
  const input = ingresarATallerSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    // Cualquier alcance concedido (TODAS o PROPIO) alcanza: requirePermission ya
    // rechaza PROHIBIDO, y a propósito no se exige ser ya el responsable actual
    // (ver comentario de la función).
    requirePermission(effective, RECURSO, "EDITAR");

    const registro = await tx.retiroEntrega.findUnique({ where: { id } });
    if (!registro) throw new RetiroEntregaNotFoundError(id);
    if (!["RETIRADO", "EN_TRASLADO"].includes(registro.estado)) {
      throw new TransicionRetiroEntregaInvalidaError(registro.estado, "EN_TALLER");
    }

    const actualizado = await tx.retiroEntrega.update({
      where: { id },
      data: {
        estado: "EN_TALLER",
        fechaHoraIngresoTaller: new Date(),
        personaQueRecibe: input.personaQueRecibe,
        ...(input.ubicacionInterna ? { ubicacionInterna: input.ubicacionInterna } : {}),
        tecnicoResponsableId: actor.usuarioId,
      },
    });

    await tx.matafuego.update({ where: { id: registro.matafuegoId }, data: { estado: "EN_TALLER" } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "RetiroEntrega",
      entidadId: id,
      valorAnterior: { estado: registro.estado, tecnicoResponsableId: registro.tecnicoResponsableId },
      valorNuevo: { estado: "EN_TALLER", tecnicoResponsableId: actor.usuarioId },
    });

    return actualizado;
  });
}

/** "Dada una unidad en taller, cuando cambia de sector interno, se conserva
 * el historial de movimientos" (RF-12): el historial es el propio audit log
 * (valorAnterior/valorNuevo en cada llamada), mismo mecanismo que usa el
 * resto del sistema — no hace falta una tabla de eventos aparte. */
export async function actualizarUbicacionInterna(actor: TenantActor, id: string, rawInput: ActualizarUbicacionInternaInput) {
  const input = actualizarUbicacionInternaSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");

    const registro = await tx.retiroEntrega.findUnique({ where: { id } });
    if (!registro) throw new RetiroEntregaNotFoundError(id);
    if (!puedeEditar(scope, registro, actor)) throw new ForbiddenError(RECURSO, "EDITAR");
    if (registro.estado !== "EN_TALLER") throw new TransicionRetiroEntregaInvalidaError(registro.estado, "EN_TALLER");

    const actualizado = await tx.retiroEntrega.update({ where: { id }, data: { ubicacionInterna: input.ubicacionInterna } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "RetiroEntrega",
      entidadId: id,
      valorAnterior: { ubicacionInterna: registro.ubicacionInterna },
      valorNuevo: { ubicacionInterna: input.ubicacionInterna },
    });

    return actualizado;
  });
}

export async function iniciarTraslado(actor: TenantActor, id: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");

    const registro = await tx.retiroEntrega.findUnique({ where: { id } });
    if (!registro) throw new RetiroEntregaNotFoundError(id);
    if (!puedeEditar(scope, registro, actor)) throw new ForbiddenError(RECURSO, "EDITAR");
    if (registro.estado !== "RETIRADO") throw new TransicionRetiroEntregaInvalidaError(registro.estado, "EN_TRASLADO");

    const actualizado = await tx.retiroEntrega.update({ where: { id }, data: { estado: "EN_TRASLADO" } });
    await tx.matafuego.update({ where: { id: registro.matafuegoId }, data: { estado: "EN_TRASLADO" } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "RetiroEntrega",
      entidadId: id,
      valorAnterior: { estado: registro.estado },
      valorNuevo: { estado: "EN_TRASLADO" },
    });

    return actualizado;
  });
}

/** "Dada una unidad entregada, cuando el cliente firma la recepción, queda
 * registrada la cadena de custodia completa" (RF-12) — firmaRecepcionNombre
 * es el mismo placeholder de conformidad que confirmacionClienteRecibida en
 * OrdenTrabajo (RF-11): la firma real (imagen) depende de RF-18, que todavía
 * no existe. */
export async function registrarEntrega(actor: TenantActor, id: string, rawInput: RegistrarEntregaInput) {
  const input = registrarEntregaSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");

    const registro = await tx.retiroEntrega.findUnique({ where: { id } });
    if (!registro) throw new RetiroEntregaNotFoundError(id);
    if (!puedeEditar(scope, registro, actor)) throw new ForbiddenError(RECURSO, "EDITAR");
    if (!["RETIRADO", "EN_TRASLADO", "EN_TALLER"].includes(registro.estado)) {
      throw new TransicionRetiroEntregaInvalidaError(registro.estado, "ENTREGADO");
    }

    const actualizado = await tx.retiroEntrega.update({
      where: { id },
      data: {
        estado: "ENTREGADO",
        fechaSalida: new Date(),
        personaQueRecibe: input.personaQueRecibe,
        firmaRecepcionNombre: input.firmaRecepcionNombre,
      },
    });

    await tx.matafuego.update({ where: { id: registro.matafuegoId }, data: { estado: "ENTREGADO" } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "RetiroEntrega",
      entidadId: id,
      valorAnterior: { estado: registro.estado },
      valorNuevo: { estado: "ENTREGADO", firmaRecepcionNombre: input.firmaRecepcionNombre },
    });

    return actualizado;
  });
}

/** Reservado a alcance TODAS, mismo criterio que cancelarOrden (RF-11): es
 * una decisión administrativa, no una acción operativa de quien tiene la
 * unidad en custodia. */
export async function cancelarRetiroEntrega(actor: TenantActor, id: string, motivo: string) {
  if (!motivo || !motivo.trim()) throw new MotivoCancelacionRequeridoInvalidoError();

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "EDITAR");

    const registro = await tx.retiroEntrega.findUnique({ where: { id } });
    if (!registro) throw new RetiroEntregaNotFoundError(id);
    if (!["RETIRADO", "EN_TRASLADO", "EN_TALLER"].includes(registro.estado)) {
      throw new TransicionRetiroEntregaInvalidaError(registro.estado, "CANCELADO");
    }

    const actualizado = await tx.retiroEntrega.update({
      where: { id },
      data: { estado: "CANCELADO", motivoCancelacion: motivo },
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "RetiroEntrega",
      entidadId: id,
      valorAnterior: { estado: registro.estado },
      valorNuevo: { estado: "CANCELADO" },
      motivo,
    });

    return actualizado;
  });
}

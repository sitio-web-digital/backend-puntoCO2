import { Prisma, type EstadoMantenimientoProgramado, type Matafuego, type TipoServicioMantenimiento } from "@prisma/client";
import type { TenantTx } from "../db/with-tenant";
import { withTenant } from "../db/with-tenant";
import { writeAudit } from "../audit/log";
import { getEffectivePermissions } from "../rbac/effective-permissions";
import { requirePermission, ForbiddenError } from "../rbac/permissions";
import type { TenantActor } from "../clientes/service";
import {
  createReglaMantenimientoSchema,
  createMantenimientoProgramadoSchema,
  reprogramarMantenimientoSchema,
  type CreateReglaMantenimientoInput,
  type CreateMantenimientoProgramadoInput,
  type ReprogramarMantenimientoInput,
} from "./schemas";

const RECURSO = "MANTENIMIENTOS" as const;

export class ReglaMantenimientoNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró la regla de mantenimiento ${id}`);
    this.name = "ReglaMantenimientoNotFoundError";
  }
}

export class MantenimientoProgramadoNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el mantenimiento programado ${id}`);
    this.name = "MantenimientoProgramadoNotFoundError";
  }
}

export class MatafuegoAsociadoNotFoundError extends Error {
  constructor(matafuegoId: string) {
    super(`El matafuego ${matafuegoId} no existe o no pertenece a esta empresa`);
    this.name = "MatafuegoAsociadoNotFoundError";
  }
}

export class ClienteAsociadoNotFoundError extends Error {
  constructor(clienteId: string) {
    super(`El cliente ${clienteId} no existe o no pertenece a esta empresa`);
    this.name = "ClienteAsociadoNotFoundError";
  }
}

export class TecnicoAsignadoInvalidoError extends Error {
  constructor(usuarioId: string) {
    super(`El usuario ${usuarioId} no existe o no pertenece a esta empresa`);
    this.name = "TecnicoAsignadoInvalidoError";
  }
}

export class MotivoRetroactivoRequeridoInvalidoError extends Error {
  constructor() {
    super("Un mantenimiento con fecha pasada (carga retroactiva) requiere indicar un motivo");
    this.name = "MotivoRetroactivoRequeridoInvalidoError";
  }
}

export class ReglaAplicableNotFoundError extends Error {
  constructor(matafuegoId: string, tipoServicio: string) {
    super(`No hay ninguna regla de mantenimiento activa aplicable a ${matafuegoId} para el servicio ${tipoServicio}`);
    this.name = "ReglaAplicableNotFoundError";
  }
}

export class TransicionMantenimientoInvalidaError extends Error {
  constructor(desde: EstadoMantenimientoProgramado, hacia: string) {
    super(`No se puede pasar de ${desde} a ${hacia}`);
    this.name = "TransicionMantenimientoInvalidaError";
  }
}

// ============================================================================
// Motor de reglas: "las periodicidades no deberán estar codificadas de forma
// rígida" (RF-08). ReglaMantenimiento es un recurso administrativo — se
// gestiona con alcance TODAS siempre, independientemente de que un técnico
// tenga VER:PROPIO sobre MANTENIMIENTOS (eso aplica a lo que le asignaron a
// ÉL, no a la configuración de periodicidades de la empresa).
// ============================================================================

async function assertClientePerteneceAlTenant(tx: TenantTx, clienteId: string) {
  const cliente = await tx.cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
  if (!cliente) throw new ClienteAsociadoNotFoundError(clienteId);
}

export async function crearReglaMantenimiento(actor: TenantActor, rawInput: CreateReglaMantenimientoInput) {
  const input = createReglaMantenimientoSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "CREAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "CREAR");

    if (input.clienteId) await assertClientePerteneceAlTenant(tx, input.clienteId);

    const regla = await tx.reglaMantenimiento.create({
      data: { tenantId: actor.tenantId, ...input } as Prisma.ReglaMantenimientoUncheckedCreateInput,
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "CREATE",
      entidad: "ReglaMantenimiento",
      entidadId: regla.id,
      valorNuevo: regla,
    });

    return regla;
  });
}

export async function listReglasMantenimiento(actor: TenantActor, filtros: { tipoServicio?: TipoServicioMantenimiento } = {}) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") return [];

    return tx.reglaMantenimiento.findMany({
      ...(filtros.tipoServicio ? { where: { tipoServicio: filtros.tipoServicio } } : {}),
      orderBy: { createdAt: "desc" },
    });
  });
}

/** Nunca se edita una regla existente: se desactiva y se crea una nueva (ver
 * comentario en el modelo). Esto es lo único que se le puede hacer a una
 * regla ya creada. */
export async function desactivarReglaMantenimiento(actor: TenantActor, id: string, motivo?: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "EDITAR");

    const regla = await tx.reglaMantenimiento.findUnique({ where: { id } });
    if (!regla) throw new ReglaMantenimientoNotFoundError(id);

    const actualizada = await tx.reglaMantenimiento.update({ where: { id }, data: { estado: "INACTIVA" } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "ReglaMantenimiento",
      entidadId: id,
      valorAnterior: { estado: regla.estado },
      valorNuevo: { estado: "INACTIVA" },
      motivo,
    });

    return actualizada;
  });
}

function puntajeEspecificidad(regla: { clienteId: string | null; tipoMatafuego: string | null; agenteExtintor: string | null }): number {
  return (regla.clienteId ? 1 : 0) + (regla.tipoMatafuego ? 1 : 0) + (regla.agenteExtintor ? 1 : 0);
}

function elegirReglaMasEspecifica<T extends { clienteId: string | null; tipoMatafuego: string | null; agenteExtintor: string | null; createdAt: Date }>(
  reglas: T[],
): T | null {
  if (reglas.length === 0) return null;
  return [...reglas].sort((a, b) => puntajeEspecificidad(b) - puntajeEspecificidad(a) || b.createdAt.getTime() - a.createdAt.getTime())[0]!;
}

function fechaBaseParaTipoServicio(matafuego: Matafuego, tipoServicio: TipoServicioMantenimiento): Date | null {
  switch (tipoServicio) {
    case "INSPECCION":
      return matafuego.fechaUltimaInspeccion;
    case "RECARGA":
    case "CAMBIO_AGENTE":
      return matafuego.fechaUltimaRecarga;
    case "PRUEBA_HIDRAULICA":
      return matafuego.fechaUltimaPruebaHidraulica;
    default:
      return matafuego.fechaUltimoMantenimiento;
  }
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

async function calcularProximoMantenimientoInterno(tx: TenantTx, matafuego: Matafuego, tipoServicio: TipoServicioMantenimiento) {
  const candidatas = await tx.reglaMantenimiento.findMany({
    where: {
      tipoServicio,
      estado: "ACTIVA",
      AND: [
        { OR: [{ clienteId: null }, { clienteId: matafuego.clienteId }] },
        { OR: [{ tipoMatafuego: null }, { tipoMatafuego: matafuego.tipo }] },
        { OR: [{ agenteExtintor: null }, { agenteExtintor: matafuego.agenteExtintor }] },
      ],
    },
  });

  const regla = elegirReglaMasEspecifica(candidatas);
  if (!regla) return { regla: null, proximaFecha: null };

  const fechaBase = fechaBaseParaTipoServicio(matafuego, tipoServicio) ?? matafuego.fechaPuestaServicio ?? matafuego.createdAt;
  return { regla, proximaFecha: addMonths(fechaBase, regla.frecuenciaMeses) };
}

/** "Dado una unidad con plan configurado, cuando se calcula su próximo
 * mantenimiento, el sistema utiliza la regla aplicable" (RF-08). Sólo
 * informativo: no crea nada, para eso está crearMantenimientoDesdeRegla. */
export async function calcularProximoMantenimiento(actor: TenantActor, matafuegoId: string, tipoServicio: TipoServicioMantenimiento) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") return null;

    const matafuego = await tx.matafuego.findUnique({ where: { id: matafuegoId } });
    if (!matafuego) throw new MatafuegoAsociadoNotFoundError(matafuegoId);

    return calcularProximoMantenimientoInterno(tx, matafuego, tipoServicio);
  });
}

// ============================================================================
// Mantenimientos programados (el calendario)
// ============================================================================

interface CrearMantenimientoParams {
  matafuegoId: string;
  establecimientoId: string;
  tipoServicio: TipoServicioMantenimiento;
  fechaProgramada: Date;
  reglaAplicadaId?: string | undefined;
  tecnicoAsignadoId?: string | undefined;
  prioridad?: "BAJA" | "MEDIA" | "ALTA" | "URGENTE" | undefined;
  motivo?: string | undefined;
  observaciones?: string | undefined;
  /**
   * Sólo true en la carga manual explícita (crearMantenimientoProgramado) con
   * fecha pasada: ahí "fecha en el pasado" significa "esto ya ocurrió y se
   * está registrando tarde" (RF-08: carga retroactiva, exige motivo, nace
   * REALIZADO). En cambio, cuando la fecha sale calculada por una regla
   * (crearMantenimientoDesdeRegla) y da en el pasado, significa "está
   * vencido/atrasado" — sigue siendo un pendiente (PROGRAMADO), no algo que
   * ya se hizo. Conflacionar ambos casos fue un bug real: el motor de reglas
   * exigía motivo para programar una recarga vencida, como si ya se hubiera
   * hecho.
   */
  tratarComoRetroactivoSiEsPasado?: boolean;
}

async function crearMantenimientoInterno(tx: TenantTx, actor: TenantActor, params: CrearMantenimientoParams) {
  const esRetroactivo = (params.tratarComoRetroactivoSiEsPasado ?? false) && params.fechaProgramada.getTime() < Date.now();
  if (esRetroactivo && !params.motivo) {
    throw new MotivoRetroactivoRequeridoInvalidoError();
  }

  const mantenimiento = await tx.mantenimientoProgramado.create({
    data: {
      tenantId: actor.tenantId,
      matafuegoId: params.matafuegoId,
      establecimientoId: params.establecimientoId,
      tipoServicio: params.tipoServicio,
      fechaProgramada: params.fechaProgramada,
      reglaAplicadaId: params.reglaAplicadaId,
      tecnicoAsignadoId: params.tecnicoAsignadoId,
      prioridad: params.prioridad ?? "MEDIA",
      motivo: params.motivo,
      observaciones: params.observaciones,
      cargadoRetroactivamente: esRetroactivo,
      estado: esRetroactivo ? "REALIZADO" : "PROGRAMADO",
    } as Prisma.MantenimientoProgramadoUncheckedCreateInput,
  });

  await writeAudit(tx, {
    tenantId: actor.tenantId,
    usuarioId: actor.usuarioId,
    accion: "CREATE",
    entidad: "MantenimientoProgramado",
    entidadId: mantenimiento.id,
    valorNuevo: mantenimiento,
    motivo: esRetroactivo ? params.motivo : undefined,
  });

  return mantenimiento;
}

async function assertTecnicoPerteneceAlTenant(tx: TenantTx, usuarioId: string) {
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } });
  if (!usuario) throw new TecnicoAsignadoInvalidoError(usuarioId);
}

export async function crearMantenimientoProgramado(actor: TenantActor, rawInput: CreateMantenimientoProgramadoInput) {
  const input = createMantenimientoProgramadoSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "CREAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "CREAR");

    const matafuego = await tx.matafuego.findUnique({ where: { id: input.matafuegoId } });
    if (!matafuego) throw new MatafuegoAsociadoNotFoundError(input.matafuegoId);

    if (input.tecnicoAsignadoId) await assertTecnicoPerteneceAlTenant(tx, input.tecnicoAsignadoId);

    return crearMantenimientoInterno(tx, actor, {
      matafuegoId: matafuego.id,
      establecimientoId: matafuego.establecimientoId,
      tipoServicio: input.tipoServicio,
      fechaProgramada: input.fechaProgramada,
      tecnicoAsignadoId: input.tecnicoAsignadoId,
      prioridad: input.prioridad,
      motivo: input.motivo,
      observaciones: input.observaciones,
      tratarComoRetroactivoSiEsPasado: true,
    });
  });
}

export async function crearMantenimientoDesdeRegla(
  actor: TenantActor,
  matafuegoId: string,
  tipoServicio: TipoServicioMantenimiento,
  opciones: { tecnicoAsignadoId?: string; prioridad?: "BAJA" | "MEDIA" | "ALTA" | "URGENTE"; observaciones?: string } = {},
) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "CREAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "CREAR");

    const matafuego = await tx.matafuego.findUnique({ where: { id: matafuegoId } });
    if (!matafuego) throw new MatafuegoAsociadoNotFoundError(matafuegoId);

    if (opciones.tecnicoAsignadoId) await assertTecnicoPerteneceAlTenant(tx, opciones.tecnicoAsignadoId);

    const { regla, proximaFecha } = await calcularProximoMantenimientoInterno(tx, matafuego, tipoServicio);
    if (!regla || !proximaFecha) throw new ReglaAplicableNotFoundError(matafuegoId, tipoServicio);

    return crearMantenimientoInterno(tx, actor, {
      matafuegoId: matafuego.id,
      establecimientoId: matafuego.establecimientoId,
      tipoServicio,
      fechaProgramada: proximaFecha,
      reglaAplicadaId: regla.id,
      tecnicoAsignadoId: opciones.tecnicoAsignadoId,
      prioridad: opciones.prioridad,
      observaciones: opciones.observaciones,
    });
  });
}

export async function listMantenimientos(
  actor: TenantActor,
  filtros: { matafuegoId?: string; estado?: EstadoMantenimientoProgramado } = {},
) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const filtrosBase: Prisma.MantenimientoProgramadoWhereInput = {
      ...(filtros.matafuegoId ? { matafuegoId: filtros.matafuegoId } : {}),
      ...(filtros.estado ? { estado: filtros.estado } : {}),
    };

    if (scope === "TODAS") {
      // Orden de calendario: lo próximo primero, no lo último creado primero.
      return tx.mantenimientoProgramado.findMany({ where: filtrosBase, orderBy: { fechaProgramada: "asc" } });
    }
    if (scope === "PROPIO") {
      return tx.mantenimientoProgramado.findMany({
        where: { ...filtrosBase, tecnicoAsignadoId: actor.usuarioId },
        orderBy: { fechaProgramada: "asc" },
      });
    }
    return [];
  });
}

export async function getMantenimiento(actor: TenantActor, id: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const mantenimiento = await tx.mantenimientoProgramado.findUnique({ where: { id } });
    if (!mantenimiento) throw new MantenimientoProgramadoNotFoundError(id);

    if (scope === "TODAS") return mantenimiento;
    if (scope === "PROPIO" && mantenimiento.tecnicoAsignadoId === actor.usuarioId) return mantenimiento;
    return null;
  });
}

const ESTADOS_REPROGRAMABLES: EstadoMantenimientoProgramado[] = ["PROGRAMADO", "REPROGRAMADO"];

/** "Dado un mantenimiento reprogramado, cuando se confirma el cambio, se
 * conserva la fecha anterior en el historial" (RF-08): la fecha vieja queda
 * en el AuditLog (valorAnterior), igual que cualquier otro cambio de campo
 * en el resto del sistema — no hace falta un campo `fechaAnterior` aparte. */
export async function reprogramarMantenimiento(actor: TenantActor, id: string, rawInput: ReprogramarMantenimientoInput) {
  const input = reprogramarMantenimientoSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "EDITAR");

    const mantenimiento = await tx.mantenimientoProgramado.findUnique({ where: { id } });
    if (!mantenimiento) throw new MantenimientoProgramadoNotFoundError(id);
    if (!ESTADOS_REPROGRAMABLES.includes(mantenimiento.estado)) {
      throw new TransicionMantenimientoInvalidaError(mantenimiento.estado, "REPROGRAMADO");
    }

    const actualizado = await tx.mantenimientoProgramado.update({
      where: { id },
      data: { fechaProgramada: input.fechaProgramada, estado: "REPROGRAMADO" },
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "MantenimientoProgramado",
      entidadId: id,
      valorAnterior: { fechaProgramada: mantenimiento.fechaProgramada, estado: mantenimiento.estado },
      valorNuevo: { fechaProgramada: actualizado.fechaProgramada, estado: actualizado.estado },
      motivo: input.motivo,
    });

    return actualizado;
  });
}

const FECHA_ULTIMA_POR_TIPO_SERVICIO: Partial<Record<TipoServicioMantenimiento, string>> = {
  INSPECCION: "fechaUltimaInspeccion",
  RECARGA: "fechaUltimaRecarga",
  CAMBIO_AGENTE: "fechaUltimaRecarga",
  PRUEBA_HIDRAULICA: "fechaUltimaPruebaHidraulica",
  MANTENIMIENTO: "fechaUltimoMantenimiento",
  REPARACION: "fechaUltimoMantenimiento",
};

export async function marcarMantenimientoRealizado(actor: TenantActor, id: string, opciones: { fechaRealizacion?: Date; motivo?: string } = {}) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "EDITAR");

    const mantenimiento = await tx.mantenimientoProgramado.findUnique({ where: { id } });
    if (!mantenimiento) throw new MantenimientoProgramadoNotFoundError(id);
    if (!ESTADOS_REPROGRAMABLES.includes(mantenimiento.estado)) {
      throw new TransicionMantenimientoInvalidaError(mantenimiento.estado, "REALIZADO");
    }

    const fechaRealizacion = opciones.fechaRealizacion ?? new Date();
    const actualizado = await tx.mantenimientoProgramado.update({ where: { id }, data: { estado: "REALIZADO" } });

    const campoFecha = FECHA_ULTIMA_POR_TIPO_SERVICIO[mantenimiento.tipoServicio];
    if (campoFecha) {
      await tx.matafuego.update({ where: { id: mantenimiento.matafuegoId }, data: { [campoFecha]: fechaRealizacion } });
    }

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "MantenimientoProgramado",
      entidadId: id,
      valorAnterior: { estado: mantenimiento.estado },
      valorNuevo: { estado: "REALIZADO" },
      motivo: opciones.motivo,
    });

    return actualizado;
  });
}

export async function cancelarMantenimiento(actor: TenantActor, id: string, motivo?: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "EDITAR");

    const mantenimiento = await tx.mantenimientoProgramado.findUnique({ where: { id } });
    if (!mantenimiento) throw new MantenimientoProgramadoNotFoundError(id);
    if (!ESTADOS_REPROGRAMABLES.includes(mantenimiento.estado)) {
      throw new TransicionMantenimientoInvalidaError(mantenimiento.estado, "CANCELADO");
    }

    const actualizado = await tx.mantenimientoProgramado.update({ where: { id }, data: { estado: "CANCELADO" } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "MantenimientoProgramado",
      entidadId: id,
      valorAnterior: { estado: mantenimiento.estado },
      valorNuevo: { estado: "CANCELADO" },
      motivo,
    });

    return actualizado;
  });
}

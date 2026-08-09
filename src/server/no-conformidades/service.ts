import { Prisma, type EstadoNoConformidad } from "@prisma/client";
import type { TenantTx } from "../db/with-tenant";
import { withTenant } from "../db/with-tenant";
import { writeAudit } from "../audit/log";
import { getEffectivePermissions } from "../rbac/effective-permissions";
import { requirePermission, ForbiddenError } from "../rbac/permissions";
import type { AlcancePermiso } from "@prisma/client";
import type { TenantActor } from "../clientes/service";
import { paginationArgs, toPaginatedResult, type PaginationParams } from "../db/pagination";
import { esResultadoNoConforme } from "../inspecciones/service";
import {
  createNoConformidadSchema,
  asignarResponsableSchema,
  resolverNoConformidadSchema,
  type CreateNoConformidadInput,
} from "./schemas";

const RECURSO = "NO_CONFORMIDADES" as const;

export class NoConformidadNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró la no conformidad ${id}`);
    this.name = "NoConformidadNotFoundError";
  }
}

export class MatafuegoAsociadoNotFoundError extends Error {
  constructor(matafuegoId: string) {
    super(`El matafuego ${matafuegoId} no existe o no pertenece a esta empresa`);
    this.name = "MatafuegoAsociadoNotFoundError";
  }
}

export class InspeccionAsociadaInvalidaError extends Error {
  constructor(inspeccionId: string) {
    super(`La inspección ${inspeccionId} no existe, no pertenece a esta empresa, o no corresponde al matafuego indicado`);
    this.name = "InspeccionAsociadaInvalidaError";
  }
}

export class ResultadoInspeccionInvalidoError extends Error {
  constructor(inspeccionId: string) {
    super(`La inspección ${inspeccionId} no tiene un resultado que requiera una no conformidad`);
    this.name = "ResultadoInspeccionInvalidoError";
  }
}

export class ResponsableAsociadoInvalidoError extends Error {
  constructor(responsableId: string) {
    super(`El usuario ${responsableId} no existe o no pertenece a esta empresa`);
    this.name = "ResponsableAsociadoInvalidoError";
  }
}

export class TransicionEstadoInvalidaError extends Error {
  constructor(desde: EstadoNoConformidad, hacia: string) {
    super(`No se puede pasar de ${desde} a ${hacia}`);
    this.name = "TransicionEstadoInvalidaError";
  }
}

export class TransicionRequiereReinspeccionInvalidaError extends Error {
  constructor() {
    super("Esta no conformidad requiere reinspección: no puede cerrarse sin pasar primero por VERIFICADA");
    this.name = "TransicionRequiereReinspeccionInvalidaError";
  }
}

export function estaVencida(nc: { fechaLimite: Date | null; estado: EstadoNoConformidad }): boolean {
  if (!nc.fechaLimite) return false;
  if (["CERRADA", "DESCARTADA", "VERIFICADA"].includes(nc.estado)) return false;
  return nc.fechaLimite.getTime() < Date.now();
}

async function assertMatafuegoPerteneceAlTenant(tx: TenantTx, matafuegoId: string) {
  const matafuego = await tx.matafuego.findUnique({ where: { id: matafuegoId }, select: { id: true } });
  if (!matafuego) throw new MatafuegoAsociadoNotFoundError(matafuegoId);
}

async function assertResponsablePerteneceAlTenant(tx: TenantTx, responsableId: string) {
  const usuario = await tx.usuario.findUnique({ where: { id: responsableId }, select: { id: true } });
  if (!usuario) throw new ResponsableAsociadoInvalidoError(responsableId);
}

/** TODAS siempre puede. PROPIO sólo si la no conformidad involucra al actor
 * (la reportó o es su responsable) — coherente con el mismo criterio de
 * "propio" que usa el alcance VER/CREAR de este recurso. */
function puedeEditar(scope: AlcancePermiso, nc: { detectadaPorId: string; responsableId: string | null }, actor: TenantActor): boolean {
  if (scope === "TODAS") return true;
  if (scope === "PROPIO") return nc.detectadaPorId === actor.usuarioId || nc.responsableId === actor.usuarioId;
  return false;
}

export async function listNoConformidades(actor: TenantActor, filtros: { matafuegoId?: string; estado?: EstadoNoConformidad } = {}) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const filtrosBase: Prisma.NoConformidadWhereInput = {
      ...(filtros.matafuegoId ? { matafuegoId: filtros.matafuegoId } : {}),
      ...(filtros.estado ? { estado: filtros.estado } : {}),
    };

    if (scope === "TODAS") {
      return tx.noConformidad.findMany({ where: filtrosBase, orderBy: { createdAt: "desc" } });
    }
    if (scope === "PROPIO") {
      return tx.noConformidad.findMany({
        where: { ...filtrosBase, OR: [{ detectadaPorId: actor.usuarioId }, { responsableId: actor.usuarioId }] },
        orderBy: { createdAt: "desc" },
      });
    }
    return [];
  });
}

export async function listNoConformidadesPaginado(
  actor: TenantActor,
  filtros: { matafuegoId?: string; estado?: EstadoNoConformidad } & PaginationParams = {},
) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const filtrosBase: Prisma.NoConformidadWhereInput = {
      ...(filtros.matafuegoId ? { matafuegoId: filtros.matafuegoId } : {}),
      ...(filtros.estado ? { estado: filtros.estado } : {}),
    };

    const { page, pageSize, skip, take } = paginationArgs(filtros);

    if (scope === "TODAS") {
      const [items, total] = await Promise.all([
        tx.noConformidad.findMany({ where: filtrosBase, orderBy: { createdAt: "desc" }, skip, take }),
        tx.noConformidad.count({ where: filtrosBase }),
      ]);
      return toPaginatedResult(items, total, page, pageSize);
    }
    if (scope === "PROPIO") {
      const where: Prisma.NoConformidadWhereInput = {
        ...filtrosBase,
        OR: [{ detectadaPorId: actor.usuarioId }, { responsableId: actor.usuarioId }],
      };
      const [items, total] = await Promise.all([
        tx.noConformidad.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
        tx.noConformidad.count({ where }),
      ]);
      return toPaginatedResult(items, total, page, pageSize);
    }
    return toPaginatedResult([], 0, 1, pageSize);
  });
}

export async function getNoConformidad(actor: TenantActor, id: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const nc = await tx.noConformidad.findUnique({ where: { id } });
    if (!nc) throw new NoConformidadNotFoundError(id);

    if (scope === "TODAS") return nc;
    if (scope === "PROPIO" && (nc.detectadaPorId === actor.usuarioId || nc.responsableId === actor.usuarioId)) return nc;
    return null;
  });
}

export async function crearNoConformidad(actor: TenantActor, rawInput: CreateNoConformidadInput) {
  const input = createNoConformidadSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    requirePermission(effective, RECURSO, "CREAR");

    await assertMatafuegoPerteneceAlTenant(tx, input.matafuegoId);

    if (input.inspeccionId) {
      const inspeccion = await tx.inspeccion.findUnique({ where: { id: input.inspeccionId }, select: { id: true, matafuegoId: true } });
      if (!inspeccion || inspeccion.matafuegoId !== input.matafuegoId) {
        throw new InspeccionAsociadaInvalidaError(input.inspeccionId);
      }
    }

    const nc = await tx.noConformidad.create({
      data: { tenantId: actor.tenantId, detectadaPorId: actor.usuarioId, ...input } as Prisma.NoConformidadUncheckedCreateInput,
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "CREATE",
      entidad: "NoConformidad",
      entidadId: nc.id,
      valorNuevo: nc,
    });

    return nc;
  });
}

/** Atajo para el flujo natural de RF-06: crea la no conformidad a partir de
 * una inspección ya registrada, copiando matafuegoId/inspeccionId, en vez de
 * pedírselos de nuevo al usuario. Sólo tiene sentido si el resultado de la
 * inspección efectivamente lo amerita (`esResultadoNoConforme`). */
export async function crearNoConformidadDesdeInspeccion(
  actor: TenantActor,
  inspeccionId: string,
  datos: Omit<CreateNoConformidadInput, "matafuegoId" | "inspeccionId">,
) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const inspeccion = await tx.inspeccion.findUnique({ where: { id: inspeccionId } });
    if (!inspeccion) throw new InspeccionAsociadaInvalidaError(inspeccionId);
    if (!esResultadoNoConforme(inspeccion.resultado)) {
      throw new ResultadoInspeccionInvalidoError(inspeccionId);
    }
    return crearNoConformidad(actor, { ...datos, matafuegoId: inspeccion.matafuegoId, inspeccionId: inspeccion.id });
  });
}

const ESTADOS_ASIGNABLES: EstadoNoConformidad[] = ["ABIERTA", "ASIGNADA", "EN_TRATAMIENTO"];

/** Asignar responsable es una acción de coordinación: se mantiene reservada a
 * alcance TODAS independientemente del EDITAR:PROPIO que tiene el técnico
 * (que le sirve para *avanzar* lo que ya es suyo, no para repartir trabajo). */
export async function asignarResponsable(actor: TenantActor, id: string, rawInput: { responsableId: string }, motivo?: string) {
  const input = asignarResponsableSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "EDITAR");

    const nc = await tx.noConformidad.findUnique({ where: { id } });
    if (!nc) throw new NoConformidadNotFoundError(id);
    if (!ESTADOS_ASIGNABLES.includes(nc.estado)) throw new TransicionEstadoInvalidaError(nc.estado, "ASIGNADA");

    await assertResponsablePerteneceAlTenant(tx, input.responsableId);

    const nuevoEstado: EstadoNoConformidad = nc.estado === "ABIERTA" ? "ASIGNADA" : nc.estado;
    const actualizada = await tx.noConformidad.update({
      where: { id },
      data: { responsableId: input.responsableId, estado: nuevoEstado },
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "NoConformidad",
      entidadId: id,
      valorAnterior: { responsableId: nc.responsableId, estado: nc.estado },
      valorNuevo: { responsableId: actualizada.responsableId, estado: actualizada.estado },
      motivo,
    });

    // Punto de enganche para RF-19 (Notificaciones): acá es donde el
    // responsable recién asignado "recibe la tarea". Se conecta cuando
    // exista el módulo de notificaciones, no antes.
    return actualizada;
  });
}

async function transicionar(
  actor: TenantActor,
  id: string,
  opciones: {
    estadosOrigenValidos: EstadoNoConformidad[];
    estadoDestino: EstadoNoConformidad;
    requiereScopeTodas: boolean;
    dataExtra?: Record<string, unknown>;
    motivo?: string | undefined;
  },
) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");

    const nc = await tx.noConformidad.findUnique({ where: { id } });
    if (!nc) throw new NoConformidadNotFoundError(id);

    const autorizado = opciones.requiereScopeTodas ? scope === "TODAS" : puedeEditar(scope, nc, actor);
    if (!autorizado) throw new ForbiddenError(RECURSO, "EDITAR");

    if (!opciones.estadosOrigenValidos.includes(nc.estado)) {
      throw new TransicionEstadoInvalidaError(nc.estado, opciones.estadoDestino);
    }

    if (opciones.estadoDestino === "CERRADA" && nc.reinspeccionRequerida && nc.estado !== "VERIFICADA") {
      throw new TransicionRequiereReinspeccionInvalidaError();
    }

    const actualizada = await tx.noConformidad.update({
      where: { id },
      data: { estado: opciones.estadoDestino, ...opciones.dataExtra },
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "NoConformidad",
      entidadId: id,
      valorAnterior: { estado: nc.estado },
      valorNuevo: { estado: opciones.estadoDestino },
      motivo: opciones.motivo,
    });

    return actualizada;
  });
}

export function iniciarTratamiento(actor: TenantActor, id: string, motivo?: string) {
  return transicionar(actor, id, {
    estadosOrigenValidos: ["ASIGNADA"],
    estadoDestino: "EN_TRATAMIENTO",
    requiereScopeTodas: false,
    motivo,
  });
}

export function resolverNoConformidad(actor: TenantActor, id: string, rawInput: { resolucion: string }) {
  const input = resolverNoConformidadSchema.parse(rawInput);
  return transicionar(actor, id, {
    estadosOrigenValidos: ["ASIGNADA", "EN_TRATAMIENTO"],
    estadoDestino: "RESUELTA",
    requiereScopeTodas: false,
    dataExtra: { resolucion: input.resolucion },
    motivo: input.resolucion,
  });
}

/** Reservado a alcance TODAS a propósito: es el paso de control de calidad,
 * normalmente lo hace alguien distinto de quien resolvió. */
export function verificarNoConformidad(actor: TenantActor, id: string, motivo?: string) {
  return transicionar(actor, id, {
    estadosOrigenValidos: ["RESUELTA"],
    estadoDestino: "VERIFICADA",
    requiereScopeTodas: true,
    motivo,
  });
}

export function cerrarNoConformidad(actor: TenantActor, id: string, motivo?: string) {
  return transicionar(actor, id, {
    estadosOrigenValidos: ["RESUELTA", "VERIFICADA"],
    estadoDestino: "CERRADA",
    requiereScopeTodas: true,
    motivo,
  });
}

export function descartarNoConformidad(actor: TenantActor, id: string, motivo?: string) {
  return transicionar(actor, id, {
    estadosOrigenValidos: ["ABIERTA", "ASIGNADA", "EN_TRATAMIENTO"],
    estadoDestino: "DESCARTADA",
    requiereScopeTodas: true,
    motivo,
  });
}

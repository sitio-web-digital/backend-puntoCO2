import { Prisma, type AccionPermiso, type CategoriaServicio, type EstadoServicio } from "@prisma/client";
import type { TenantTx } from "../db/with-tenant";
import { withTenant } from "../db/with-tenant";
import { writeAudit } from "../audit/log";
import { getEffectivePermissions } from "../rbac/effective-permissions";
import { requirePermission, ForbiddenError } from "../rbac/permissions";
import { paginationArgs, toPaginatedResult, type PaginationParams } from "../db/pagination";
import type { TenantActor } from "../clientes/service";
import { createServicioSchema, updateServicioSchema, type CreateServicioInput, type UpdateServicioInput } from "./schemas";

const RECURSO = "SERVICIOS_PRECIOS" as const;

export class ServicioNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el servicio ${id}`);
    this.name = "ServicioNotFoundError";
  }
}

export class CodigoServicioDuplicadoError extends Error {
  constructor(codigo: string) {
    super(`Ya existe un servicio con código ${codigo} en esta empresa`);
    this.name = "CodigoServicioDuplicadoError";
  }
}

export class ServicioNoSeleccionableInvalidoError extends Error {
  constructor(id: string) {
    super(`El servicio ${id} está desactivado y no puede seleccionarse`);
    this.name = "ServicioNoSeleccionableInvalidoError";
  }
}

function requireScopeTodas(scope: string, accion: AccionPermiso): void {
  if (scope !== "TODAS") {
    throw new ForbiddenError(RECURSO, accion);
  }
}

/** El margen no se guarda: se deriva de precioBase/costoEstimado en cada
 * lectura, para que nunca pueda quedar desincronizado de los valores reales. */
export function calcularMargen(servicio: { precioBase: Prisma.Decimal; costoEstimado: Prisma.Decimal | null }) {
  if (!servicio.costoEstimado) return { margenAbsoluto: null, margenPorcentaje: null };
  const precio = servicio.precioBase.toNumber();
  const costo = servicio.costoEstimado.toNumber();
  const margenAbsoluto = precio - costo;
  const margenPorcentaje = precio > 0 ? (margenAbsoluto / precio) * 100 : null;
  return { margenAbsoluto, margenPorcentaje };
}

// ============================================================================
// Catálogo de servicios
// ============================================================================

async function assertCodigoDisponible(tx: TenantTx, codigo: string, excluirId?: string) {
  const existente = await tx.servicio.findFirst({ where: { codigo, ...(excluirId ? { id: { not: excluirId } } : {}) }, select: { id: true } });
  if (existente) throw new CodigoServicioDuplicadoError(codigo);
}

export async function crearServicio(actor: TenantActor, rawInput: CreateServicioInput) {
  const input = createServicioSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "CREAR");
    requireScopeTodas(scope, "CREAR");

    await assertCodigoDisponible(tx, input.codigo);

    const servicio = await tx.servicio.create({
      data: { tenantId: actor.tenantId, ...input } as Prisma.ServicioUncheckedCreateInput,
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "CREATE",
      entidad: "Servicio",
      entidadId: servicio.id,
      valorNuevo: servicio,
    });

    return servicio;
  });
}

export async function listServicios(actor: TenantActor, filtros: { estado?: EstadoServicio; categoria?: CategoriaServicio } = {}) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") return [];

    return tx.servicio.findMany({
      where: { ...(filtros.estado ? { estado: filtros.estado } : {}), ...(filtros.categoria ? { categoria: filtros.categoria } : {}) },
      orderBy: { nombre: "asc" },
    });
  });
}

export async function listServiciosPaginado(
  actor: TenantActor,
  filtros: { estado?: EstadoServicio; categoria?: CategoriaServicio } & PaginationParams = {},
) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") {
      return toPaginatedResult([], 0, 1, paginationArgs(filtros).pageSize);
    }

    const where = { ...(filtros.estado ? { estado: filtros.estado } : {}), ...(filtros.categoria ? { categoria: filtros.categoria } : {}) };
    const { page, pageSize, skip, take } = paginationArgs(filtros);
    const [items, total] = await Promise.all([
      tx.servicio.findMany({ where, orderBy: { nombre: "asc" }, skip, take }),
      tx.servicio.count({ where }),
    ]);
    return toPaginatedResult(items, total, page, pageSize);
  });
}

export async function getServicio(actor: TenantActor, id: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") return null;

    const servicio = await tx.servicio.findUnique({ where: { id } });
    if (!servicio) throw new ServicioNotFoundError(id);
    return servicio;
  });
}

/** Para que RF-11 (Órdenes de trabajo) pueda validar "servicio desactivado no
 * puede seleccionarse" sin tener que reimplementar el chequeo. */
export async function getServicioSeleccionable(actor: TenantActor, id: string) {
  const servicio = await getServicio(actor, id);
  if (!servicio) throw new ServicioNotFoundError(id);
  if (servicio.estado !== "ACTIVO") throw new ServicioNoSeleccionableInvalidoError(id);
  return servicio;
}

export async function updateServicio(actor: TenantActor, id: string, rawInput: UpdateServicioInput) {
  const input = updateServicioSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    requireScopeTodas(scope, "EDITAR");

    const existing = await tx.servicio.findUnique({ where: { id } });
    if (!existing) throw new ServicioNotFoundError(id);

    if (input.codigo && input.codigo !== existing.codigo) {
      await assertCodigoDisponible(tx, input.codigo, id);
    }

    const actualizado = await tx.servicio.update({ where: { id }, data: input as Prisma.ServicioUncheckedUpdateInput });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "Servicio",
      entidadId: id,
      valorAnterior: existing,
      valorNuevo: actualizado,
    });

    return actualizado;
  });
}

async function cambiarEstadoServicio(actor: TenantActor, id: string, nuevoEstado: EstadoServicio, motivo?: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    requireScopeTodas(scope, "EDITAR");

    const existing = await tx.servicio.findUnique({ where: { id } });
    if (!existing) throw new ServicioNotFoundError(id);

    const actualizado = await tx.servicio.update({ where: { id }, data: { estado: nuevoEstado } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "Servicio",
      entidadId: id,
      valorAnterior: { estado: existing.estado },
      valorNuevo: { estado: nuevoEstado },
      motivo,
    });

    return actualizado;
  });
}

export function desactivarServicio(actor: TenantActor, id: string, motivo?: string) {
  return cambiarEstadoServicio(actor, id, "INACTIVO", motivo);
}

export function reactivarServicio(actor: TenantActor, id: string, motivo?: string) {
  return cambiarEstadoServicio(actor, id, "ACTIVO", motivo);
}


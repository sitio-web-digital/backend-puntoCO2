import { Prisma, type AccionPermiso, type CategoriaServicio, type EstadoServicio } from "@prisma/client";
import type { TenantTx } from "../db/with-tenant";
import { withTenant } from "../db/with-tenant";
import { writeAudit } from "../audit/log";
import { getEffectivePermissions } from "../rbac/effective-permissions";
import { requirePermission, ForbiddenError } from "../rbac/permissions";
import { paginationArgs, toPaginatedResult, type PaginationParams } from "../db/pagination";
import type { TenantActor } from "../clientes/service";
import {
  createServicioSchema,
  updateServicioSchema,
  createListaPrecioSchema,
  updateListaPrecioSchema,
  fijarPrecioSchema,
  type CreateServicioInput,
  type UpdateServicioInput,
  type CreateListaPrecioInput,
  type UpdateListaPrecioInput,
  type FijarPrecioInput,
} from "./schemas";

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

export class ListaPrecioNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró la lista de precios ${id}`);
    this.name = "ListaPrecioNotFoundError";
  }
}

export class NombreListaPrecioDuplicadoError extends Error {
  constructor(nombre: string) {
    super(`Ya existe una lista de precios llamada "${nombre}" en esta empresa`);
    this.name = "NombreListaPrecioDuplicadoError";
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

// ============================================================================
// Listas de precios
// ============================================================================

async function assertNombreListaDisponible(tx: TenantTx, nombre: string) {
  const existente = await tx.listaPrecio.findFirst({ where: { nombre }, select: { id: true } });
  if (existente) throw new NombreListaPrecioDuplicadoError(nombre);
}

export async function crearListaPrecio(actor: TenantActor, rawInput: CreateListaPrecioInput) {
  const input = createListaPrecioSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "CREAR");
    requireScopeTodas(scope, "CREAR");

    await assertNombreListaDisponible(tx, input.nombre);

    const lista = await tx.listaPrecio.create({
      data: { tenantId: actor.tenantId, ...input } as Prisma.ListaPrecioUncheckedCreateInput,
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "CREATE",
      entidad: "ListaPrecio",
      entidadId: lista.id,
      valorNuevo: lista,
    });

    return lista;
  });
}

export async function listListasPrecio(actor: TenantActor) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") return [];

    return tx.listaPrecio.findMany({ orderBy: { nombre: "asc" } });
  });
}

export async function listListasPrecioPaginado(actor: TenantActor, filtros: PaginationParams = {}) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") {
      return toPaginatedResult([], 0, 1, paginationArgs(filtros).pageSize);
    }

    const { page, pageSize, skip, take } = paginationArgs(filtros);
    const [items, total] = await Promise.all([
      tx.listaPrecio.findMany({ orderBy: { nombre: "asc" }, skip, take }),
      tx.listaPrecio.count(),
    ]);
    return toPaginatedResult(items, total, page, pageSize);
  });
}

export async function getListaPrecio(actor: TenantActor, id: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") return null;

    const lista = await tx.listaPrecio.findUnique({ where: { id }, include: { precios: true } });
    if (!lista) throw new ListaPrecioNotFoundError(id);
    return lista;
  });
}

export async function updateListaPrecio(actor: TenantActor, id: string, rawInput: UpdateListaPrecioInput) {
  const input = updateListaPrecioSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    requireScopeTodas(scope, "EDITAR");

    const existing = await tx.listaPrecio.findUnique({ where: { id } });
    if (!existing) throw new ListaPrecioNotFoundError(id);

    if (input.nombre && input.nombre !== existing.nombre) {
      await assertNombreListaDisponible(tx, input.nombre);
    }

    const actualizada = await tx.listaPrecio.update({ where: { id }, data: input as Prisma.ListaPrecioUncheckedUpdateInput });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "ListaPrecio",
      entidadId: id,
      valorAnterior: existing,
      valorNuevo: actualizada,
    });

    return actualizada;
  });
}

async function cambiarEstadoListaPrecio(actor: TenantActor, id: string, nuevoEstado: "ACTIVA" | "INACTIVA", motivo?: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    requireScopeTodas(scope, "EDITAR");

    const existing = await tx.listaPrecio.findUnique({ where: { id } });
    if (!existing) throw new ListaPrecioNotFoundError(id);

    const actualizada = await tx.listaPrecio.update({ where: { id }, data: { estado: nuevoEstado } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "ListaPrecio",
      entidadId: id,
      valorAnterior: { estado: existing.estado },
      valorNuevo: { estado: nuevoEstado },
      motivo,
    });

    return actualizada;
  });
}

export function desactivarListaPrecio(actor: TenantActor, id: string, motivo?: string) {
  return cambiarEstadoListaPrecio(actor, id, "INACTIVA", motivo);
}

export function reactivarListaPrecio(actor: TenantActor, id: string, motivo?: string) {
  return cambiarEstadoListaPrecio(actor, id, "ACTIVA", motivo);
}

/**
 * Fija un precio nuevo para (lista, servicio): cierra el precio vigente
 * anterior (si había uno) y crea uno nuevo. Nunca se pisa un registro — así
 * se preserva el historial de precios (RF-09) y una orden que ya copió un
 * precio en su momento no se ve afectada por cambios posteriores.
 */
export async function fijarPrecio(actor: TenantActor, listaPrecioId: string, servicioId: string, rawInput: FijarPrecioInput) {
  const input = fijarPrecioSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    requireScopeTodas(scope, "EDITAR");

    const lista = await tx.listaPrecio.findUnique({ where: { id: listaPrecioId }, select: { id: true } });
    if (!lista) throw new ListaPrecioNotFoundError(listaPrecioId);

    const servicio = await tx.servicio.findUnique({ where: { id: servicioId }, select: { id: true } });
    if (!servicio) throw new ServicioNotFoundError(servicioId);

    const vigenteDesde = input.vigenteDesde ?? new Date();

    const anterior = await tx.precioServicio.findFirst({ where: { listaPrecioId, servicioId, vigenteHasta: null } });
    if (anterior) {
      await tx.precioServicio.update({ where: { id: anterior.id }, data: { vigenteHasta: vigenteDesde } });
    }

    const nuevo = await tx.precioServicio.create({
      data: { tenantId: actor.tenantId, listaPrecioId, servicioId, precio: input.precio, vigenteDesde },
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "CREATE",
      entidad: "PrecioServicio",
      entidadId: nuevo.id,
      valorAnterior: anterior ? { precio: anterior.precio.toString() } : undefined,
      valorNuevo: { precio: nuevo.precio.toString(), vigenteDesde: nuevo.vigenteDesde },
    });

    return nuevo;
  });
}

export interface PrecioVigente {
  servicioId: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  moneda: string;
  fuente: "lista" | "base";
}

/**
 * "Se copia su precio y descripción vigentes" (RF-09): si el cliente/orden
 * tiene una lista de precios asignada y hay un precio vigente ahí, se usa
 * ese; si no, se cae al precioBase del catálogo. RF-11 llama a esto al
 * agregar un servicio a una orden y graba el resultado tal cual en la orden
 * — ese snapshot, no esta función, es lo que preserva el valor histórico.
 */
export async function resolverPrecioVigente(actor: TenantActor, servicioId: string, listaPrecioId?: string): Promise<PrecioVigente> {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    requireScopeTodas(scope, "VER");

    const servicio = await tx.servicio.findUnique({ where: { id: servicioId } });
    if (!servicio) throw new ServicioNotFoundError(servicioId);

    if (listaPrecioId) {
      const ahora = new Date();
      const precioLista = await tx.precioServicio.findFirst({
        where: { listaPrecioId, servicioId, vigenteDesde: { lte: ahora }, OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: ahora } }] },
        orderBy: { vigenteDesde: "desc" },
      });
      if (precioLista) {
        return {
          servicioId,
          nombre: servicio.nombre,
          descripcion: servicio.descripcion,
          precio: precioLista.precio.toNumber(),
          moneda: servicio.moneda,
          fuente: "lista",
        };
      }
    }

    return {
      servicioId,
      nombre: servicio.nombre,
      descripcion: servicio.descripcion,
      precio: servicio.precioBase.toNumber(),
      moneda: servicio.moneda,
      fuente: "base",
    };
  });
}

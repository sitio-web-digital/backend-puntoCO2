import { Prisma, type AccionPermiso, type EstadoSector, type EstadoUbicacion } from "@prisma/client";
import type { TenantTx } from "../db/with-tenant";
import { withTenant } from "../db/with-tenant";
import { writeAudit } from "../audit/log";
import { getEffectivePermissions } from "../rbac/effective-permissions";
import { requirePermission, ForbiddenError } from "../rbac/permissions";
import type { TenantActor } from "../clientes/service";
import {
  createSectorSchema,
  updateSectorSchema,
  createUbicacionSchema,
  updateUbicacionSchema,
  type CreateSectorInput,
  type UpdateSectorInput,
  type CreateUbicacionInput,
  type UpdateUbicacionInput,
} from "./schemas";

// Sector y Ubicación no tienen recurso propio en el catálogo de RBAC: cuelgan
// de Establecimiento y se gobiernan con ese mismo permiso (ver default-roles.ts).
const RECURSO = "ESTABLECIMIENTOS" as const;

export class SectorNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el sector ${id}`);
    this.name = "SectorNotFoundError";
  }
}

export class UbicacionNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró la ubicación ${id}`);
    this.name = "UbicacionNotFoundError";
  }
}

export class EstablecimientoAsociadoNotFoundError extends Error {
  constructor(establecimientoId: string) {
    super(`El establecimiento ${establecimientoId} no existe o no pertenece a esta empresa`);
    this.name = "EstablecimientoAsociadoNotFoundError";
  }
}

export class SectorPadreInvalidoError extends Error {
  constructor(parentSectorId: string) {
    super(`El sector padre ${parentSectorId} no existe, no pertenece a esta empresa, o es de otro establecimiento`);
    this.name = "SectorPadreInvalidoError";
  }
}

export class SectorAsociadoNotFoundError extends Error {
  constructor(sectorId: string) {
    super(`El sector ${sectorId} no existe o no pertenece a esta empresa`);
    this.name = "SectorAsociadoNotFoundError";
  }
}

function requireScopeTodasOrDeny(accion: AccionPermiso, scope: string): void {
  if (scope !== "TODAS") {
    throw new ForbiddenError(RECURSO, accion);
  }
}

async function assertEstablecimientoPerteneceAlTenant(tx: TenantTx, establecimientoId: string): Promise<void> {
  const establecimiento = await tx.establecimiento.findUnique({ where: { id: establecimientoId }, select: { id: true } });
  if (!establecimiento) throw new EstablecimientoAsociadoNotFoundError(establecimientoId);
}

/** El sector padre, si se indica, debe existir, pertenecer al tenant activo
 * (garantizado por RLS dentro de esta misma transacción) y estar en el MISMO
 * establecimiento: una jerarquía que cruza establecimientos no tiene sentido. */
async function assertParentSectorValido(tx: TenantTx, establecimientoId: string, parentSectorId: string): Promise<void> {
  const parent = await tx.sector.findUnique({ where: { id: parentSectorId }, select: { establecimientoId: true } });
  if (!parent || parent.establecimientoId !== establecimientoId) {
    throw new SectorPadreInvalidoError(parentSectorId);
  }
}

async function assertSectorPerteneceAlTenant(tx: TenantTx, sectorId: string): Promise<void> {
  const sector = await tx.sector.findUnique({ where: { id: sectorId }, select: { id: true } });
  if (!sector) throw new SectorAsociadoNotFoundError(sectorId);
}

// ============================================================================
// Sectores
// ============================================================================

export async function listSectoresDeEstablecimiento(actor: TenantActor, establecimientoId: string, filtros: { estado?: EstadoSector } = {}) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") return [];

    return tx.sector.findMany({
      where: { establecimientoId, ...(filtros.estado ? { estado: filtros.estado } : {}) },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function getSector(actor: TenantActor, sectorId: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") return null;

    const sector = await tx.sector.findUnique({ where: { id: sectorId }, include: { subSectores: true, ubicaciones: true } });
    if (!sector) throw new SectorNotFoundError(sectorId);
    return sector;
  });
}

export async function createSector(actor: TenantActor, rawInput: CreateSectorInput) {
  const input = createSectorSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    requirePermission(effective, RECURSO, "CREAR");

    await assertEstablecimientoPerteneceAlTenant(tx, input.establecimientoId);
    if (input.parentSectorId) {
      await assertParentSectorValido(tx, input.establecimientoId, input.parentSectorId);
    }

    const sector = await tx.sector.create({
      data: { tenantId: actor.tenantId, ...input } as Prisma.SectorUncheckedCreateInput,
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "CREATE",
      entidad: "Sector",
      entidadId: sector.id,
      valorNuevo: sector,
    });

    return sector;
  });
}

export async function updateSector(actor: TenantActor, sectorId: string, rawInput: UpdateSectorInput) {
  const input = updateSectorSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    requireScopeTodasOrDeny("EDITAR", scope);

    const existing = await tx.sector.findUnique({ where: { id: sectorId } });
    if (!existing) throw new SectorNotFoundError(sectorId);

    const actualizado = await tx.sector.update({ where: { id: sectorId }, data: input as Prisma.SectorUncheckedUpdateInput });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "Sector",
      entidadId: sectorId,
      valorAnterior: existing,
      valorNuevo: actualizado,
    });

    return actualizado;
  });
}

async function cambiarEstadoSector(actor: TenantActor, sectorId: string, nuevoEstado: EstadoSector, motivo?: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const accionRequerida = nuevoEstado === "DADO_DE_BAJA" ? "ELIMINAR" : "EDITAR";
    const scope = requirePermission(effective, RECURSO, accionRequerida);
    requireScopeTodasOrDeny(accionRequerida, scope);

    const existing = await tx.sector.findUnique({ where: { id: sectorId } });
    if (!existing) throw new SectorNotFoundError(sectorId);

    const actualizado = await tx.sector.update({ where: { id: sectorId }, data: { estado: nuevoEstado } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "Sector",
      entidadId: sectorId,
      valorAnterior: { estado: existing.estado },
      valorNuevo: { estado: nuevoEstado },
      motivo,
    });

    return actualizado;
  });
}

export function suspenderSector(actor: TenantActor, sectorId: string, motivo?: string) {
  return cambiarEstadoSector(actor, sectorId, "SUSPENDIDO", motivo);
}
export function reactivarSector(actor: TenantActor, sectorId: string, motivo?: string) {
  return cambiarEstadoSector(actor, sectorId, "ACTIVO", motivo);
}
export function darDeBajaSector(actor: TenantActor, sectorId: string, motivo?: string) {
  return cambiarEstadoSector(actor, sectorId, "DADO_DE_BAJA", motivo);
}

// ============================================================================
// Ubicaciones
// ============================================================================

export async function listUbicacionesDeSector(actor: TenantActor, sectorId: string, filtros: { estado?: EstadoUbicacion } = {}) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") return [];

    return tx.ubicacion.findMany({
      where: { sectorId, ...(filtros.estado ? { estado: filtros.estado } : {}) },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function getUbicacion(actor: TenantActor, ubicacionId: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") return null;

    const ubicacion = await tx.ubicacion.findUnique({ where: { id: ubicacionId } });
    if (!ubicacion) throw new UbicacionNotFoundError(ubicacionId);
    return ubicacion;
  });
}

export async function createUbicacion(actor: TenantActor, rawInput: CreateUbicacionInput) {
  const input = createUbicacionSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    requirePermission(effective, RECURSO, "CREAR");

    await assertSectorPerteneceAlTenant(tx, input.sectorId);

    const ubicacion = await tx.ubicacion.create({
      data: { tenantId: actor.tenantId, ...input } as Prisma.UbicacionUncheckedCreateInput,
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "CREATE",
      entidad: "Ubicacion",
      entidadId: ubicacion.id,
      valorNuevo: ubicacion,
    });

    return ubicacion;
  });
}

export async function updateUbicacion(actor: TenantActor, ubicacionId: string, rawInput: UpdateUbicacionInput) {
  const input = updateUbicacionSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    requireScopeTodasOrDeny("EDITAR", scope);

    const existing = await tx.ubicacion.findUnique({ where: { id: ubicacionId } });
    if (!existing) throw new UbicacionNotFoundError(ubicacionId);

    const actualizado = await tx.ubicacion.update({ where: { id: ubicacionId }, data: input as Prisma.UbicacionUncheckedUpdateInput });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "Ubicacion",
      entidadId: ubicacionId,
      valorAnterior: existing,
      valorNuevo: actualizado,
    });

    return actualizado;
  });
}

async function cambiarEstadoUbicacion(actor: TenantActor, ubicacionId: string, nuevoEstado: EstadoUbicacion, motivo?: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const accionRequerida = nuevoEstado === "DADO_DE_BAJA" ? "ELIMINAR" : "EDITAR";
    const scope = requirePermission(effective, RECURSO, accionRequerida);
    requireScopeTodasOrDeny(accionRequerida, scope);

    const existing = await tx.ubicacion.findUnique({ where: { id: ubicacionId } });
    if (!existing) throw new UbicacionNotFoundError(ubicacionId);

    const actualizado = await tx.ubicacion.update({ where: { id: ubicacionId }, data: { estado: nuevoEstado } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "Ubicacion",
      entidadId: ubicacionId,
      valorAnterior: { estado: existing.estado },
      valorNuevo: { estado: nuevoEstado },
      motivo,
    });

    return actualizado;
  });
}

export function suspenderUbicacion(actor: TenantActor, ubicacionId: string, motivo?: string) {
  return cambiarEstadoUbicacion(actor, ubicacionId, "SUSPENDIDO", motivo);
}
export function reactivarUbicacion(actor: TenantActor, ubicacionId: string, motivo?: string) {
  return cambiarEstadoUbicacion(actor, ubicacionId, "ACTIVO", motivo);
}
export function darDeBajaUbicacion(actor: TenantActor, ubicacionId: string, motivo?: string) {
  return cambiarEstadoUbicacion(actor, ubicacionId, "DADO_DE_BAJA", motivo);
}

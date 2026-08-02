import { Prisma, type AccionPermiso, type EstadoEstablecimiento } from "@prisma/client";
import type { TenantTx } from "../db/with-tenant";
import { withTenant } from "../db/with-tenant";
import { writeAudit } from "../audit/log";
import { getEffectivePermissions } from "../rbac/effective-permissions";
import { requirePermission, ForbiddenError } from "../rbac/permissions";
import type { TenantActor } from "../clientes/service";
import {
  createEstablecimientoSchema,
  updateEstablecimientoSchema,
  type CreateEstablecimientoInput,
  type UpdateEstablecimientoInput,
} from "./schemas";

export class EstablecimientoNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el establecimiento ${id}`);
    this.name = "EstablecimientoNotFoundError";
  }
}

export class ClienteAsociadoNotFoundError extends Error {
  constructor(clienteId: string) {
    super(`El cliente ${clienteId} no existe o no pertenece a esta empresa`);
    this.name = "ClienteAsociadoNotFoundError";
  }
}

/** Ver el comentario homólogo en clientes/service.ts: hasta que exista el
 * concepto de "técnico asignado a un establecimiento", cualquier alcance que
 * no sea TODAS se trata como sin acceso, nunca como acceso total. */
function requireScopeTodasOrDeny(scope: string, accion: AccionPermiso): void {
  if (scope !== "TODAS") {
    throw new ForbiddenError("ESTABLECIMIENTOS", accion);
  }
}

/** El FK de Postgres no alcanza para esto bajo RLS: valida en runtime que el
 * cliente exista y pertenezca al tenant activo, apoyándose en que la lectura
 * de Cliente ya está scopeada por RLS dentro de esta misma transacción. Sin
 * este chequeo, alguien podría crear un establecimiento apuntando al
 * clienteId de otro tenant (los triggers de FK de Postgres corren evadiendo
 * RLS de la tabla referenciada). */
async function assertClientePerteneceAlTenant(tx: TenantTx, clienteId: string): Promise<void> {
  const cliente = await tx.cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
  if (!cliente) {
    throw new ClienteAsociadoNotFoundError(clienteId);
  }
}

export async function listEstablecimientosDeCliente(actor: TenantActor, clienteId: string, filtros: { estado?: EstadoEstablecimiento } = {}) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, "ESTABLECIMIENTOS", "VER");
    if (scope !== "TODAS") return [];

    return tx.establecimiento.findMany({
      where: { clienteId, ...(filtros.estado ? { estado: filtros.estado } : {}) },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function getEstablecimiento(actor: TenantActor, establecimientoId: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, "ESTABLECIMIENTOS", "VER");
    if (scope !== "TODAS") return null;

    const establecimiento = await tx.establecimiento.findUnique({ where: { id: establecimientoId } });
    if (!establecimiento) throw new EstablecimientoNotFoundError(establecimientoId);
    return establecimiento;
  });
}

export async function createEstablecimiento(actor: TenantActor, rawInput: CreateEstablecimientoInput) {
  const input = createEstablecimientoSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    requirePermission(effective, "ESTABLECIMIENTOS", "CREAR");

    await assertClientePerteneceAlTenant(tx, input.clienteId);

    const establecimiento = await tx.establecimiento.create({
      data: { tenantId: actor.tenantId, ...input } as Prisma.EstablecimientoUncheckedCreateInput,
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "CREATE",
      entidad: "Establecimiento",
      entidadId: establecimiento.id,
      valorNuevo: establecimiento,
    });

    return establecimiento;
  });
}

export async function updateEstablecimiento(actor: TenantActor, establecimientoId: string, rawInput: UpdateEstablecimientoInput) {
  const input = updateEstablecimientoSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, "ESTABLECIMIENTOS", "EDITAR");
    requireScopeTodasOrDeny(scope, "EDITAR");

    const existing = await tx.establecimiento.findUnique({ where: { id: establecimientoId } });
    if (!existing) throw new EstablecimientoNotFoundError(establecimientoId);

    const actualizado = await tx.establecimiento.update({
      where: { id: establecimientoId },
      data: input as Prisma.EstablecimientoUncheckedUpdateInput,
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "Establecimiento",
      entidadId: establecimientoId,
      valorAnterior: existing,
      valorNuevo: actualizado,
    });

    return actualizado;
  });
}

async function cambiarEstadoEstablecimiento(actor: TenantActor, establecimientoId: string, nuevoEstado: EstadoEstablecimiento, motivo?: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const accionRequerida = nuevoEstado === "DADO_DE_BAJA" ? "ELIMINAR" : "EDITAR";
    const scope = requirePermission(effective, "ESTABLECIMIENTOS", accionRequerida);
    requireScopeTodasOrDeny(scope, accionRequerida);

    const existing = await tx.establecimiento.findUnique({ where: { id: establecimientoId } });
    if (!existing) throw new EstablecimientoNotFoundError(establecimientoId);

    const actualizado = await tx.establecimiento.update({ where: { id: establecimientoId }, data: { estado: nuevoEstado } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "Establecimiento",
      entidadId: establecimientoId,
      valorAnterior: { estado: existing.estado },
      valorNuevo: { estado: nuevoEstado },
      motivo,
    });

    return actualizado;
  });
}

export function suspenderEstablecimiento(actor: TenantActor, establecimientoId: string, motivo?: string) {
  return cambiarEstadoEstablecimiento(actor, establecimientoId, "SUSPENDIDO", motivo);
}

export function reactivarEstablecimiento(actor: TenantActor, establecimientoId: string, motivo?: string) {
  return cambiarEstadoEstablecimiento(actor, establecimientoId, "ACTIVO", motivo);
}

export function darDeBajaEstablecimiento(actor: TenantActor, establecimientoId: string, motivo?: string) {
  return cambiarEstadoEstablecimiento(actor, establecimientoId, "DADO_DE_BAJA", motivo);
}

import { Prisma, type AccionPermiso, type EstadoCliente } from "@prisma/client";
import { withTenant } from "../db/with-tenant";
import { writeAudit } from "../audit/log";
import { getEffectivePermissions } from "../rbac/effective-permissions";
import { requirePermission, ForbiddenError } from "../rbac/permissions";
import { paginationArgs, toPaginatedResult, type PaginationParams } from "../db/pagination";
import { createClienteSchema, updateClienteSchema, type CreateClienteInput, type UpdateClienteInput } from "./schemas";

export interface TenantActor {
  tenantId: string;
  usuarioId: string;
}

export class ClienteNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el cliente ${id}`);
    this.name = "ClienteNotFoundError";
  }
}

export class CuitDuplicadoError extends Error {
  constructor(cuit: string) {
    super(`Ya existe un cliente con CUIT ${cuit} en esta empresa`);
    this.name = "CuitDuplicadoError";
  }
}

/**
 * El alcance ESTABLECIMIENTO_ASIGNADO/PROPIO para el recurso CLIENTES todavía
 * no se puede resolver: depende del modelo de Establecimiento (RF-02) y de a
 * qué establecimientos está asignado un técnico, que aún no existe. Hasta que
 * se implemente, cualquier alcance que no sea TODAS se trata como "sin
 * visibilidad" en vez de concederse de más — fail closed, no fail open.
 */
function requireScopeTodasOrDeny(scope: string, accion: AccionPermiso): void {
  if (scope !== "TODAS") {
    throw new ForbiddenError("CLIENTES", accion);
  }
}

export async function listClientes(actor: TenantActor, filtros: { estado?: EstadoCliente } = {}) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, "CLIENTES", "VER");
    if (scope !== "TODAS") {
      return [];
    }
    return tx.cliente.findMany({
      ...(filtros.estado ? { where: { estado: filtros.estado } } : {}),
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function listClientesPaginado(actor: TenantActor, filtros: { estado?: EstadoCliente } & PaginationParams = {}) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, "CLIENTES", "VER");
    if (scope !== "TODAS") {
      return toPaginatedResult([], 0, 1, paginationArgs(filtros).pageSize);
    }

    const where = filtros.estado ? { estado: filtros.estado } : {};
    const { page, pageSize, skip, take } = paginationArgs(filtros);
    const [items, total] = await Promise.all([
      tx.cliente.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      tx.cliente.count({ where }),
    ]);
    return toPaginatedResult(items, total, page, pageSize);
  });
}

export async function getCliente(actor: TenantActor, clienteId: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, "CLIENTES", "VER");
    if (scope !== "TODAS") {
      return null;
    }
    const cliente = await tx.cliente.findUnique({ where: { id: clienteId }, include: { contactos: true } });
    if (!cliente) throw new ClienteNotFoundError(clienteId);
    return cliente;
  });
}

export async function createCliente(actor: TenantActor, rawInput: CreateClienteInput) {
  const input = createClienteSchema.parse(rawInput);

  try {
    return await withTenant({ tenantId: actor.tenantId }, async (tx) => {
      const effective = await getEffectivePermissions(tx, actor.usuarioId);
      requirePermission(effective, "CLIENTES", "CREAR");

      const cliente = await tx.cliente.create({
        // Zod tipa los campos opcionales como `T | undefined` aunque en runtime
        // los ausentes nunca aparecen como clave con valor undefined; el cast
        // es seguro porque venimos de un `.parse()` recién hecho.
        data: { tenantId: actor.tenantId, ...input } as Prisma.ClienteUncheckedCreateInput,
      });

      await writeAudit(tx, {
        tenantId: actor.tenantId,
        usuarioId: actor.usuarioId,
        accion: "CREATE",
        entidad: "Cliente",
        entidadId: cliente.id,
        valorNuevo: cliente,
      });

      return cliente;
    });
  } catch (err) {
    throw translateUniqueConstraintError(err, input.cuit);
  }
}

export async function updateCliente(actor: TenantActor, clienteId: string, rawInput: UpdateClienteInput) {
  const input = updateClienteSchema.parse(rawInput);

  try {
    return await withTenant({ tenantId: actor.tenantId }, async (tx) => {
      const effective = await getEffectivePermissions(tx, actor.usuarioId);
      const scope = requirePermission(effective, "CLIENTES", "EDITAR");
      requireScopeTodasOrDeny(scope, "EDITAR");

      const existing = await tx.cliente.findUnique({ where: { id: clienteId } });
      if (!existing) throw new ClienteNotFoundError(clienteId);

      const actualizado = await tx.cliente.update({ where: { id: clienteId }, data: input as Prisma.ClienteUncheckedUpdateInput });

      await writeAudit(tx, {
        tenantId: actor.tenantId,
        usuarioId: actor.usuarioId,
        accion: "UPDATE",
        entidad: "Cliente",
        entidadId: clienteId,
        valorAnterior: existing,
        valorNuevo: actualizado,
      });

      return actualizado;
    });
  } catch (err) {
    throw translateUniqueConstraintError(err, input.cuit);
  }
}

async function cambiarEstadoCliente(actor: TenantActor, clienteId: string, nuevoEstado: EstadoCliente, motivo?: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    // La baja lógica es destructiva desde la perspectiva del negocio (saca al
    // cliente de circulación), así que la tratamos como ELIMINAR aunque el
    // registro se conserve en la base — coherente con "baja lógica" de RF-01.
    const accionRequerida = nuevoEstado === "DADO_DE_BAJA" ? "ELIMINAR" : "EDITAR";
    const scope = requirePermission(effective, "CLIENTES", accionRequerida);
    requireScopeTodasOrDeny(scope, accionRequerida);

    const existing = await tx.cliente.findUnique({ where: { id: clienteId } });
    if (!existing) throw new ClienteNotFoundError(clienteId);

    const actualizado = await tx.cliente.update({ where: { id: clienteId }, data: { estado: nuevoEstado } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "Cliente",
      entidadId: clienteId,
      valorAnterior: { estado: existing.estado },
      valorNuevo: { estado: nuevoEstado },
      motivo,
    });

    return actualizado;
  });
}

export function suspenderCliente(actor: TenantActor, clienteId: string, motivo?: string) {
  return cambiarEstadoCliente(actor, clienteId, "SUSPENDIDO", motivo);
}

export function reactivarCliente(actor: TenantActor, clienteId: string, motivo?: string) {
  return cambiarEstadoCliente(actor, clienteId, "ACTIVO", motivo);
}

export function darDeBajaCliente(actor: TenantActor, clienteId: string, motivo?: string) {
  return cambiarEstadoCliente(actor, clienteId, "DADO_DE_BAJA", motivo);
}

function translateUniqueConstraintError(err: unknown, cuit: string | undefined): unknown {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && cuit) {
    return new CuitDuplicadoError(cuit);
  }
  return err;
}

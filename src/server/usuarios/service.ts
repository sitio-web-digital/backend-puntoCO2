import { Prisma, type EstadoUsuario } from "@prisma/client";
import type { TenantTx } from "../db/with-tenant";
import { withTenant } from "../db/with-tenant";
import { writeAudit } from "../audit/log";
import { getEffectivePermissions } from "../rbac/effective-permissions";
import { requirePermission, ForbiddenError } from "../rbac/permissions";
import { paginationArgs, toPaginatedResult, type PaginationParams } from "../db/pagination";
import { hashPassword } from "../auth/password";
import type { TenantActor } from "../clientes/service";
import {
  invitarUsuarioSchema,
  actualizarUsuarioSchema,
  asignarRolesSchema,
  type InvitarUsuarioInput,
  type ActualizarUsuarioInput,
  type AsignarRolesInput,
} from "./schemas";

const RECURSO = "USUARIOS_ROLES" as const;
const ROL_ADMINISTRADOR = "Administrador de empresa";

export class UsuarioNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el usuario ${id}`);
    this.name = "UsuarioNotFoundError";
  }
}

export class EmailUsuarioDuplicadoError extends Error {
  constructor(email: string) {
    super(`Ya existe un usuario con email ${email} en esta empresa`);
    this.name = "EmailUsuarioDuplicadoError";
  }
}

export class RolAsociadoInvalidoError extends Error {
  constructor(rolId: string) {
    super(`El rol ${rolId} no existe o no pertenece a esta empresa`);
    this.name = "RolAsociadoInvalidoError";
  }
}

export class UltimoAdministradorInvalidoError extends Error {
  constructor() {
    super("No puede quedar la empresa sin ningún Administrador de empresa activo");
    this.name = "UltimoAdministradorInvalidoError";
  }
}

async function assertRolesPertenecenAlTenant(tx: TenantTx, rolIds: string[]) {
  const roles = await tx.rol.findMany({ where: { id: { in: rolIds } } });
  const encontrados = new Set(roles.map((r) => r.id));
  for (const rolId of rolIds) {
    if (!encontrados.has(rolId)) throw new RolAsociadoInvalidoError(rolId);
  }
  return roles;
}

async function assertEmailDisponible(tx: TenantTx, email: string) {
  const existente = await tx.usuario.findFirst({ where: { email }, select: { id: true } });
  if (existente) throw new EmailUsuarioDuplicadoError(email);
}

/** "No puede quedar la empresa sin administrador" (regla de integridad no
 * pedida explícitamente por RF-27, pero necesaria: sin ella un admin podría
 * suspenderse o quitarse el rol a sí mismo y dejar el tenant sin nadie que
 * pueda volver a gestionar usuarios). Cuenta administradores ACTIVOS
 * excluyendo al usuario que se está por modificar. */
async function contarOtrosAdministradoresActivos(tx: TenantTx, usuarioIdExcluido: string): Promise<number> {
  return tx.usuario.count({
    where: {
      id: { not: usuarioIdExcluido },
      estado: "ACTIVO",
      roles: { some: { rol: { nombre: ROL_ADMINISTRADOR } } },
    },
  });
}

export async function listUsuarios(actor: TenantActor, filtros: { estado?: EstadoUsuario } = {}) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") return [];

    return tx.usuario.findMany({
      where: { ...(filtros.estado ? { estado: filtros.estado } : {}) },
      include: { roles: { include: { rol: true } } },
      omit: { passwordHash: true },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function listUsuariosPaginado(actor: TenantActor, filtros: { estado?: EstadoUsuario } & PaginationParams = {}) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") {
      return toPaginatedResult([], 0, 1, paginationArgs(filtros).pageSize);
    }

    const where = { ...(filtros.estado ? { estado: filtros.estado } : {}) };
    const { page, pageSize, skip, take } = paginationArgs(filtros);
    const [items, total] = await Promise.all([
      tx.usuario.findMany({
        where,
        include: { roles: { include: { rol: true } } },
        omit: { passwordHash: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      tx.usuario.count({ where }),
    ]);
    return toPaginatedResult(items, total, page, pageSize);
  });
}

export async function getUsuario(actor: TenantActor, id: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") return null;

    const usuario = await tx.usuario.findUnique({
      where: { id },
      include: { roles: { include: { rol: true } } },
      omit: { passwordHash: true },
    });
    if (!usuario) throw new UsuarioNotFoundError(id);
    return usuario;
  });
}

/**
 * Alta de un usuario dentro del tenant, con su/s rol/es ya asignados. No hay
 * flujo de invitación por email real todavía (RF-19 no tiene proveedor de
 * email configurado): el administrador fija la contraseña inicial
 * directamente, igual que se hace hoy al dar de alta el tenant
 * (tenants/provisioning.ts). El propio usuario podrá cambiarla después de
 * iniciar sesión cuando exista esa función.
 */
export async function invitarUsuario(actor: TenantActor, rawInput: InvitarUsuarioInput) {
  const input = invitarUsuarioSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "CREAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "CREAR");

    await assertEmailDisponible(tx, input.email);
    await assertRolesPertenecenAlTenant(tx, input.rolIds);

    const passwordHash = await hashPassword(input.password);
    const usuario = await tx.usuario.create({
      data: {
        tenantId: actor.tenantId,
        email: input.email,
        passwordHash,
        nombre: input.nombre,
        apellido: input.apellido,
        roles: { create: input.rolIds.map((rolId) => ({ rolId })) },
      },
      include: { roles: { include: { rol: true } } },
      omit: { passwordHash: true },
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "CREATE",
      entidad: "Usuario",
      entidadId: usuario.id,
      valorNuevo: { email: usuario.email, nombre: usuario.nombre, apellido: usuario.apellido, roles: input.rolIds },
    });

    return usuario;
  });
}

export async function actualizarUsuario(actor: TenantActor, id: string, rawInput: ActualizarUsuarioInput) {
  const input = actualizarUsuarioSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "EDITAR");

    const existing = await tx.usuario.findUnique({ where: { id } });
    if (!existing) throw new UsuarioNotFoundError(id);

    if (input.estado && input.estado !== "ACTIVO" && existing.estado === "ACTIVO") {
      const esAdministrador = await tx.usuarioRol.findFirst({ where: { usuarioId: id, rol: { nombre: ROL_ADMINISTRADOR } } });
      if (esAdministrador) {
        const otros = await contarOtrosAdministradoresActivos(tx, id);
        if (otros === 0) throw new UltimoAdministradorInvalidoError();
      }
    }

    const actualizado = await tx.usuario.update({
      where: { id },
      data: input as Prisma.UsuarioUncheckedUpdateInput,
      include: { roles: { include: { rol: true } } },
      omit: { passwordHash: true },
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "Usuario",
      entidadId: id,
      valorAnterior: { nombre: existing.nombre, apellido: existing.apellido, estado: existing.estado },
      valorNuevo: { nombre: actualizado.nombre, apellido: actualizado.apellido, estado: actualizado.estado },
    });

    return actualizado;
  });
}

/** Reemplaza el conjunto completo de roles asignados (no agrega/quita
 * incrementalmente): más simple de razonar desde una UI con checkboxes, y
 * evita que queden asignaciones residuales de un estado anterior. */
export async function asignarRoles(actor: TenantActor, id: string, rawInput: AsignarRolesInput) {
  const input = asignarRolesSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "EDITAR");

    const existing = await tx.usuario.findUnique({ where: { id } });
    if (!existing) throw new UsuarioNotFoundError(id);
    await assertRolesPertenecenAlTenant(tx, input.rolIds);

    const rolesAnteriores = await tx.usuarioRol.findMany({ where: { usuarioId: id }, select: { rol: { select: { nombre: true } } } });
    const tieneAdminActual = rolesAnteriores.some((r) => r.rol.nombre === ROL_ADMINISTRADOR);
    const roles = await tx.rol.findMany({ where: { id: { in: input.rolIds } }, select: { id: true, nombre: true } });
    const tendraAdminNuevo = roles.some((r) => r.nombre === ROL_ADMINISTRADOR);

    if (tieneAdminActual && !tendraAdminNuevo && existing.estado === "ACTIVO") {
      const otros = await contarOtrosAdministradoresActivos(tx, id);
      if (otros === 0) throw new UltimoAdministradorInvalidoError();
    }

    await tx.usuarioRol.deleteMany({ where: { usuarioId: id } });
    await tx.usuarioRol.createMany({ data: input.rolIds.map((rolId) => ({ usuarioId: id, rolId })) });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "Usuario",
      entidadId: id,
      valorAnterior: { roles: rolesAnteriores.map((r) => r.rol.nombre) },
      valorNuevo: { roles: roles.map((r) => r.nombre) },
    });

    return tx.usuario.findUniqueOrThrow({
      where: { id },
      include: { roles: { include: { rol: true } } },
      omit: { passwordHash: true },
    });
  });
}

export async function listRoles(actor: TenantActor) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") return [];

    return tx.rol.findMany({ orderBy: { nombre: "asc" } });
  });
}

import type { EstadoTicketSoporte } from "@prisma/client";
import { withTenant, type TenantTx } from "../db/with-tenant";
import { paginationArgs, toPaginatedResult, type PaginationParams } from "../db/pagination";
import type { TenantActor } from "../clientes/service";
import type { PlatformActor } from "../platform/service";

export type { TenantActor } from "../clientes/service";
export type { PlatformActor } from "../platform/service";
import { crearTicketSchema, responderTicketSchema, cambiarEstadoTicketSchema, type CrearTicketInput } from "./schemas";

export class TicketSoporteNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el ticket de soporte ${id}`);
    this.name = "TicketSoporteNotFoundError";
  }
}

const MENSAJES_ORDENADOS = { orderBy: { createdAt: "asc" } } as const;

interface AutorDeMensaje {
  autorId: string;
  esSuperAdmin: boolean;
}

/**
 * Resuelve el nombre/apellido de quien escribió cada mensaje SIN usar el
 * `include` relacional de Prisma hacia `Usuario`: la política RLS de
 * `usuarios` sólo deja ver filas con `tenantId` nulo (el superadmin SaaS)
 * cuando la sesión de Postgres tiene `bypass_rls=on` explícito. Un ticket
 * respondido por el superadmin, leído en contexto de tenant (sin
 * bypassRls), hace que ese join devuelva la fila oculta por RLS — y como
 * `autor` es una relación obligatoria en el schema, Prisma tira una
 * excepción en vez de `null` (`getTicketDeTenant` rompía con 500 acá).
 * En vez de ensanchar el RLS de `usuarios` (expondría la existencia de
 * cuentas de superadmin a cualquier tenant), resolvemos los dos grupos de
 * autores por separado: los del propio tenant con la misma transacción, y
 * los del superadmin con una consulta aparte en bypassRls.
 */
async function adjuntarAutores<T extends AutorDeMensaje>(tx: TenantTx, mensajes: T[]): Promise<(T & { autor: { nombre: string; apellido: string } })[]> {
  const idsTenant = [...new Set(mensajes.filter((m) => !m.esSuperAdmin).map((m) => m.autorId))];
  const idsSuperAdmin = [...new Set(mensajes.filter((m) => m.esSuperAdmin).map((m) => m.autorId))];

  const [autoresTenant, autoresSuperAdmin] = await Promise.all([
    idsTenant.length > 0
      ? tx.usuario.findMany({ where: { id: { in: idsTenant } }, select: { id: true, nombre: true, apellido: true } })
      : Promise.resolve([]),
    idsSuperAdmin.length > 0
      ? withTenant({ tenantId: null, bypassRls: true }, (tx2) =>
          tx2.usuario.findMany({ where: { id: { in: idsSuperAdmin } }, select: { id: true, nombre: true, apellido: true } }),
        )
      : Promise.resolve([]),
  ]);

  const porId = new Map([...autoresTenant, ...autoresSuperAdmin].map((u) => [u.id, { nombre: u.nombre, apellido: u.apellido }]));
  return mensajes.map((m) => ({ ...m, autor: porId.get(m.autorId) ?? { nombre: "Usuario", apellido: "desconocido" } }));
}

// ---------------------------------------------------------------------------
// Lado empresa
// ---------------------------------------------------------------------------

export async function crearTicket(actor: TenantActor, rawInput: CrearTicketInput) {
  const input = crearTicketSchema.parse(rawInput);
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    return tx.ticketSoporte.create({
      data: {
        tenantId: actor.tenantId,
        creadoPorId: actor.usuarioId,
        asunto: input.asunto,
        ...(input.prioridad ? { prioridad: input.prioridad } : {}),
        mensajes: {
          create: {
            tenantId: actor.tenantId,
            autorId: actor.usuarioId,
            esSuperAdmin: false,
            cuerpo: input.mensaje,
          },
        },
      },
      include: { mensajes: true },
    });
  });
}

/** Visibilidad compartida dentro de la empresa: cualquier usuario del tenant
 * ve y puede responder todos los tickets, no sólo los que él mismo creó — es
 * un canal de soporte compartido, no un buzón individual. */
export async function listTicketsDeTenantPaginado(
  actor: TenantActor,
  filtros: { estado?: EstadoTicketSoporte } & PaginationParams = {},
) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const where = filtros.estado ? { estado: filtros.estado } : {};
    const { page, pageSize, skip, take } = paginationArgs(filtros);
    const [items, total] = await Promise.all([
      tx.ticketSoporte.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      tx.ticketSoporte.count({ where }),
    ]);
    return toPaginatedResult(items, total, page, pageSize);
  });
}

export async function getTicketDeTenant(actor: TenantActor, id: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const ticket = await tx.ticketSoporte.findUnique({
      where: { id },
      include: { mensajes: MENSAJES_ORDENADOS },
    });
    // RLS ya filtra por tenant; el chequeo explícito es para devolver
    // TicketSoporteNotFoundError (404) en vez de que Prisma devuelva null crudo.
    if (!ticket) throw new TicketSoporteNotFoundError(id);
    const mensajes = await adjuntarAutores(tx, ticket.mensajes);
    return { ...ticket, mensajes };
  });
}

/** Si el ticket estaba RESUELTO/CERRADO y la empresa vuelve a escribir, el
 * ticket necesita atención de nuevo: se reabre automáticamente. */
export async function responderTicket(actor: TenantActor, id: string, cuerpo: string) {
  const input = responderTicketSchema.parse({ cuerpo });
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const existing = await tx.ticketSoporte.findUnique({ where: { id } });
    if (!existing) throw new TicketSoporteNotFoundError(id);

    await tx.mensajeTicket.create({
      data: { tenantId: actor.tenantId, ticketId: id, autorId: actor.usuarioId, esSuperAdmin: false, cuerpo: input.cuerpo },
    });

    const nuevoEstado = existing.estado === "RESUELTO" || existing.estado === "CERRADO" ? "ABIERTO" : existing.estado;
    const actualizado = await tx.ticketSoporte.update({
      where: { id },
      data: { estado: nuevoEstado },
      include: { mensajes: MENSAJES_ORDENADOS },
    });
    const mensajes = await adjuntarAutores(tx, actualizado.mensajes);
    return { ...actualizado, mensajes };
  });
}

// ---------------------------------------------------------------------------
// Lado plataforma (superadmin SaaS)
// ---------------------------------------------------------------------------

export async function listTicketsPlataforma(
  actor: PlatformActor,
  filtros: { estado?: EstadoTicketSoporte } & PaginationParams = {},
) {
  return withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
    const where = filtros.estado ? { estado: filtros.estado } : {};
    const { page, pageSize, skip, take } = paginationArgs(filtros);
    const [items, total] = await Promise.all([
      tx.ticketSoporte.findMany({
        where,
        include: { tenant: { select: { nombre: true, slug: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      tx.ticketSoporte.count({ where }),
    ]);
    return toPaginatedResult(items, total, page, pageSize);
  });
}

export async function getTicketPlataforma(actor: PlatformActor, id: string) {
  return withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
    const ticket = await tx.ticketSoporte.findUnique({
      where: { id },
      include: {
        tenant: { select: { nombre: true, slug: true } },
        mensajes: MENSAJES_ORDENADOS,
      },
    });
    if (!ticket) throw new TicketSoporteNotFoundError(id);
    const mensajes = await adjuntarAutores(tx, ticket.mensajes);
    return { ...ticket, mensajes };
  });
}

/** El superadmin respondiendo un ticket ABIERTO significa que ya lo está
 * atendiendo: pasa a EN_PROGRESO automáticamente. */
export async function responderTicketPlataforma(actor: PlatformActor, id: string, cuerpo: string) {
  const input = responderTicketSchema.parse({ cuerpo });
  return withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
    const existing = await tx.ticketSoporte.findUnique({ where: { id } });
    if (!existing) throw new TicketSoporteNotFoundError(id);

    await tx.mensajeTicket.create({
      data: {
        tenantId: existing.tenantId,
        ticketId: id,
        autorId: actor.usuarioId,
        esSuperAdmin: true,
        cuerpo: input.cuerpo,
      },
    });

    const nuevoEstado = existing.estado === "ABIERTO" ? "EN_PROGRESO" : existing.estado;
    const actualizado = await tx.ticketSoporte.update({
      where: { id },
      data: { estado: nuevoEstado },
      include: { tenant: { select: { nombre: true, slug: true } }, mensajes: MENSAJES_ORDENADOS },
    });
    const mensajes = await adjuntarAutores(tx, actualizado.mensajes);
    return { ...actualizado, mensajes };
  });
}

export async function cambiarEstadoTicketPlataforma(actor: PlatformActor, id: string, estado: EstadoTicketSoporte) {
  const input = cambiarEstadoTicketSchema.parse({ estado });
  return withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
    const existing = await tx.ticketSoporte.findUnique({ where: { id } });
    if (!existing) throw new TicketSoporteNotFoundError(id);
    return tx.ticketSoporte.update({ where: { id }, data: { estado: input.estado } });
  });
}

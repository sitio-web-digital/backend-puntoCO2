import { z } from "zod";
import type { EstadoTenant } from "@prisma/client";
import { withTenant } from "../db/with-tenant";
import { writeAudit } from "../audit/log";
import { paginationArgs, toPaginatedResult, type PaginationParams } from "../db/pagination";
import { createTenant, createTenantSchema, type CreateTenantInput } from "../tenants/provisioning";
import { aplicarVencimientosPendientes, aplicarVencimientoTenant, DURACION_CICLO_PAGO_DIAS } from "./vencimientos";

/** Actor de las operaciones de plataforma: siempre el Superadministrador SaaS
 * (tenantId null), verificado por `requireSuperAdmin()` antes de llegar acá. */
export interface PlatformActor {
  usuarioId: string;
}

export class TenantNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró la empresa ${id}`);
    this.name = "TenantNotFoundError";
  }
}

const CONTEO_RELACIONES = {
  usuarios: true,
  clientes: true,
  matafuegos: true,
} as const;

export async function listTenantsPlataforma(actor: PlatformActor, filtros: { estado?: EstadoTenant } & PaginationParams = {}) {
  return withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
    await aplicarVencimientosPendientes(tx);

    const where = filtros.estado ? { estado: filtros.estado } : {};
    const { page, pageSize, skip, take } = paginationArgs(filtros);
    const [items, total] = await Promise.all([
      tx.tenant.findMany({
        where,
        include: { _count: { select: CONTEO_RELACIONES } },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      tx.tenant.count({ where }),
    ]);
    return toPaginatedResult(items, total, page, pageSize);
  });
}

/** Contadores agregados para el panel de resumen: sin esto habría que traer
 * TODOS los tenants a memoria sólo para contarlos por estado. */
/** No recibe `actor`: es una agregación pura sin alcance por usuario, gateada
 * igual que el resto sólo por `requireSuperAdmin()` en la ruta que la llama. */
export async function resumenPlataforma() {
  return withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
    await aplicarVencimientosPendientes(tx);

    const [porEstado, totalUsuarios, totalMatafuegos, ticketsAbiertos] = await Promise.all([
      tx.tenant.groupBy({ by: ["estado"], _count: { _all: true } }),
      tx.usuario.count({ where: { tenantId: { not: null } } }),
      tx.matafuego.count(),
      tx.ticketSoporte.count({ where: { estado: { in: ["ABIERTO", "EN_PROGRESO"] } } }),
    ]);

    const conteoPorEstado = Object.fromEntries(porEstado.map((r) => [r.estado, r._count._all])) as Record<string, number>;
    const totalEmpresas = porEstado.reduce((acc, r) => acc + r._count._all, 0);

    return { totalEmpresas, conteoPorEstado, totalUsuarios, totalMatafuegos, ticketsAbiertos };
  });
}

export async function getTenantPlataforma(actor: PlatformActor, id: string) {
  return withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id },
      include: {
        _count: { select: CONTEO_RELACIONES },
        usuarios: { where: { estado: "ACTIVO" }, orderBy: { createdAt: "asc" }, omit: { passwordHash: true } },
      },
    });
    if (!tenant) throw new TenantNotFoundError(id);
    const estadoActual = await aplicarVencimientoTenant(tx, tenant);
    return { ...tenant, estado: estadoActual };
  });
}

export async function crearTenantPlataforma(actor: PlatformActor, rawInput: CreateTenantInput) {
  const input = createTenantSchema.parse(rawInput);
  return createTenant(input, { usuarioId: actor.usuarioId });
}

async function cambiarEstadoTenant(actor: PlatformActor, id: string, nuevoEstado: EstadoTenant, motivo?: string) {
  return withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
    const existing = await tx.tenant.findUnique({ where: { id } });
    if (!existing) throw new TenantNotFoundError(id);

    const actualizado = await tx.tenant.update({ where: { id }, data: { estado: nuevoEstado } });

    await writeAudit(tx, {
      tenantId: id,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "Tenant",
      entidadId: id,
      valorAnterior: { estado: existing.estado },
      valorNuevo: { estado: nuevoEstado },
      motivo,
    });

    return actualizado;
  });
}

export function suspenderTenantPlataforma(actor: PlatformActor, id: string, motivo?: string) {
  return cambiarEstadoTenant(actor, id, "SUSPENDIDO", motivo);
}

export function reactivarTenantPlataforma(actor: PlatformActor, id: string, motivo?: string) {
  return cambiarEstadoTenant(actor, id, "ACTIVO", motivo);
}

/** Cambio de estado genérico (además de los atajos `suspender`/`reactivar`
 * de arriba): hace falta para pasar TRIAL → ACTIVO al confirmar una
 * suscripción paga, o para marcar VENCIDO/CANCELADO — estados que no son ni
 * "suspender" ni "reactivar" pero también deben poder asignarse a mano
 * mientras no haya cobro real integrado (ver CLAUDE.md, RF de suscripciones). */
const estadoTenantSchema = z.enum(["TRIAL", "ACTIVO", "SUSPENDIDO", "VENCIDO", "CANCELADO"]);

export async function cambiarEstadoTenantPlataforma(actor: PlatformActor, id: string, estadoCrudo: EstadoTenant, motivo?: string) {
  const estado = estadoTenantSchema.parse(estadoCrudo);
  return cambiarEstadoTenant(actor, id, estado, motivo);
}

/** "Confirmé el pago": pasa a ACTIVO y extiende la vigencia un ciclo más
 * (30 días) desde hoy, limpiando `vencidoDesde`. Es la única acción que
 * además de cambiar el estado toca las fechas de vigencia — por eso no
 * reusa `cambiarEstadoTenant` — así que reemplaza a "Activar suscripción" y
 * "Reactivar" como la acción de uso normal: activar sin renovar la vigencia
 * dejaría a la empresa con una fecha de vencimiento ya vieja, que el chequeo
 * automático volvería a vencer en el próximo login. */
export async function marcarPagoTenant(actor: PlatformActor, id: string, motivo?: string) {
  return withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
    const existing = await tx.tenant.findUnique({ where: { id } });
    if (!existing) throw new TenantNotFoundError(id);

    const vigenciaHasta = new Date(Date.now() + DURACION_CICLO_PAGO_DIAS * 24 * 60 * 60 * 1000);
    const actualizado = await tx.tenant.update({
      where: { id },
      data: { estado: "ACTIVO", vigenciaHasta, vencidoDesde: null },
    });

    await writeAudit(tx, {
      tenantId: id,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "Tenant",
      entidadId: id,
      valorAnterior: { estado: existing.estado, vigenciaHasta: existing.vigenciaHasta },
      valorNuevo: { estado: "ACTIVO", vigenciaHasta },
      motivo: motivo ?? "Pago confirmado",
    });

    return actualizado;
  });
}

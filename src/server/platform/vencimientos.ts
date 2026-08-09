import type { EstadoTenant } from "@prisma/client";
import type { TenantTx } from "../db/with-tenant";
import { writeAudit } from "../audit/log";

/** Sin cobro automático con Mercado Pago todavía, el único plazo de gracia
 * real es administrativo: cuánto tiempo se le da a una empresa vencida antes
 * de suspenderla si nadie confirmó el pago. */
const GRACIA_VENCIDO_A_SUSPENDIDO_MS = 2 * 24 * 60 * 60 * 1000;

export const DURACION_CICLO_PAGO_DIAS = 30;

interface TenantVigencia {
  id: string;
  estado: EstadoTenant;
  vigenciaHasta: Date | null;
  vencidoDesde: Date | null;
}

/**
 * Chequeo perezoso del ciclo de vida de un tenant: TRIAL/ACTIVO pasa a
 * VENCIDO si se pasó `vigenciaHasta`, y VENCIDO pasa a SUSPENDIDO si pasaron
 * más de 2 días desde que entró a VENCIDO sin que se marcara el pago. No hay
 * cron: esto se llama en cada login del tenant y en cada lectura del panel
 * de plataforma (ver login-service.ts y platform/service.ts), así que el
 * estado se corrige la primera vez que alguien lo necesita, sin depender de
 * infraestructura programada.
 */
export async function aplicarVencimientoTenant(tx: TenantTx, tenant: TenantVigencia): Promise<EstadoTenant> {
  const ahora = new Date();

  if ((tenant.estado === "TRIAL" || tenant.estado === "ACTIVO") && tenant.vigenciaHasta && tenant.vigenciaHasta.getTime() < ahora.getTime()) {
    await tx.tenant.update({ where: { id: tenant.id }, data: { estado: "VENCIDO", vencidoDesde: ahora } });
    await writeAudit(tx, {
      tenantId: tenant.id,
      usuarioId: null,
      accion: "STATUS_CHANGE",
      entidad: "Tenant",
      entidadId: tenant.id,
      valorAnterior: { estado: tenant.estado },
      valorNuevo: { estado: "VENCIDO" },
      motivo: "Vencimiento automático: se cumplió la vigencia sin renovación",
    });
    return "VENCIDO";
  }

  if (tenant.estado === "VENCIDO" && tenant.vencidoDesde && ahora.getTime() - tenant.vencidoDesde.getTime() > GRACIA_VENCIDO_A_SUSPENDIDO_MS) {
    await tx.tenant.update({ where: { id: tenant.id }, data: { estado: "SUSPENDIDO" } });
    await writeAudit(tx, {
      tenantId: tenant.id,
      usuarioId: null,
      accion: "STATUS_CHANGE",
      entidad: "Tenant",
      entidadId: tenant.id,
      valorAnterior: { estado: "VENCIDO" },
      valorNuevo: { estado: "SUSPENDIDO" },
      motivo: "Suspensión automática: sin pago dentro del plazo de gracia tras el vencimiento",
    });
    return "SUSPENDIDO";
  }

  return tenant.estado;
}

/** Versión en lote para las lecturas de plataforma (listado/resumen), donde
 * no hay un único tenant "actual" sobre el que chequear. */
export async function aplicarVencimientosPendientes(tx: TenantTx): Promise<void> {
  const candidatos = await tx.tenant.findMany({
    where: { estado: { in: ["TRIAL", "ACTIVO", "VENCIDO"] } },
    select: { id: true, estado: true, vigenciaHasta: true, vencidoDesde: true },
  });
  for (const tenant of candidatos) {
    await aplicarVencimientoTenant(tx, tenant);
  }
}

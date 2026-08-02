import { Prisma, type AccionAuditoria } from "@prisma/client";
import type { TenantTx } from "../db/with-tenant";

export interface AuditEntry {
  tenantId: string | null;
  usuarioId: string | null;
  accion: AccionAuditoria;
  entidad: string;
  entidadId?: string | undefined;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
  motivo?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

/**
 * Escribe en audit_logs dentro de la MISMA transacción que la operación que
 * audita, para que ambas se confirmen o reviertan juntas (no queremos un
 * cambio crítico sin su registro de auditoría por un fallo a mitad de camino).
 */
export async function writeAudit(tx: TenantTx, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: entry.tenantId,
      usuarioId: entry.usuarioId,
      accion: entry.accion,
      entidad: entry.entidad,
      entidadId: entry.entidadId ?? null,
      valorAnterior: entry.valorAnterior === undefined ? Prisma.JsonNull : (entry.valorAnterior as object),
      valorNuevo: entry.valorNuevo === undefined ? Prisma.JsonNull : (entry.valorNuevo as object),
      motivo: entry.motivo ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}

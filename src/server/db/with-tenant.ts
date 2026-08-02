import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export type TenantTx = Prisma.TransactionClient;

interface WithTenantOptions {
  /**
   * Id del tenant activo del request. Null solo es válido junto con bypassRls,
   * para rutas de superadmin SaaS que operan a nivel plataforma.
   */
  tenantId: string | null;
  /**
   * Sólo debe activarse desde código explícitamente de superadmin SaaS
   * (ver src/server/rbac/permissions.ts). Permite leer filas cross-tenant
   * o de plataforma (tenantId NULL) que la política de RLS oculta por defecto.
   */
  bypassRls?: boolean;
}

/**
 * Ejecuta `fn` dentro de una transacción con el contexto de tenant seteado a
 * nivel de sesión de Postgres (`SET LOCAL app.tenant_id`), que las políticas
 * de Row-Level Security de las tablas de negocio usan para filtrar filas.
 *
 * Esta es la segunda capa de aislamiento: la primera es que cada repositorio
 * exige tenantId explícito en su `where`. Si alguna vez un repositorio se
 * escribe mal y omite el filtro, RLS igual corta el acceso cross-tenant.
 */
export async function withTenant<T>(
  options: WithTenantOptions,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  if (!options.tenantId && !options.bypassRls) {
    throw new Error("withTenant requiere tenantId, o bypassRls explícito para rutas de plataforma");
  }

  return prisma.$transaction(async (tx) => {
    if (options.bypassRls) {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    }
    if (options.tenantId) {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${options.tenantId}, true)`;
    }
    return fn(tx);
  });
}

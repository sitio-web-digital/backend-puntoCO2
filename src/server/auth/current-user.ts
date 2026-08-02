import { getAccessTokenCookie } from "./cookies";
import { verifyAccessToken } from "./tokens";

export interface CurrentUser {
  usuarioId: string;
  tenantId: string | null;
  esSuperAdminSaas: boolean;
}

export class UnauthorizedError extends Error {
  constructor(message = "No autenticado") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Lee y verifica el access token de la cookie de la request actual. Es la
 * puerta de entrada al contexto de tenant/usuario para cualquier route
 * handler o Server Component: todo el resto del sistema (permisos, RLS,
 * auditoría) parte de acá. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await getAccessTokenCookie();
  if (!token) return null;

  const claims = await verifyAccessToken(token);
  if (!claims) return null;

  return { usuarioId: claims.sub, tenantId: claims.tenantId, esSuperAdminSaas: claims.esSuperAdminSaas };
}

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Para rutas de negocio de un tenant: garantiza tenantId no nulo, cosa que
 * `CurrentUser` por sí solo no puede expresar en el tipo (el superadmin SaaS
 * tiene tenantId null). */
export async function requireTenantUser(): Promise<CurrentUser & { tenantId: string }> {
  const user = await requireCurrentUser();
  if (!user.tenantId) {
    throw new UnauthorizedError("Esta operación requiere un usuario de una empresa, no el superadmin SaaS");
  }
  return user as CurrentUser & { tenantId: string };
}

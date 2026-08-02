import { withTenant } from "../db/with-tenant";
import { rotateSession } from "./session-service";
import { signAccessToken } from "./tokens";

interface SessionMeta {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export type RefreshResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; reason: "invalid_token" | "user_inactive" };

/**
 * Rota el refresh token y emite un nuevo access token. El usuario se busca
 * con bypassRls porque, al igual que en login, todavía no sabemos a qué
 * tenant pertenece hasta after resolver el token — es la misma situación
 * legítima de "identidad aún no resuelta" que en login-service.
 */
export async function refreshAccessToken(refreshTokenPlain: string, meta: SessionMeta = {}): Promise<RefreshResult> {
  const rotated = await rotateSession(refreshTokenPlain, meta);
  if (!rotated.ok) {
    return { ok: false, reason: "invalid_token" };
  }

  const usuario = await withTenant({ tenantId: null, bypassRls: true }, (tx) => tx.usuario.findUnique({ where: { id: rotated.usuarioId } }));

  if (!usuario || usuario.estado !== "ACTIVO") {
    return { ok: false, reason: "user_inactive" };
  }

  const accessToken = await signAccessToken({
    sub: usuario.id,
    tenantId: usuario.tenantId,
    esSuperAdminSaas: usuario.esSuperAdminSaas,
  });

  return { ok: true, accessToken, refreshToken: rotated.refreshToken };
}

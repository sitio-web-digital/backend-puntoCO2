import { prisma } from "../db/client";
import { generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_TTL_MS } from "./refresh-token";

interface SessionMeta {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export async function createSession(usuarioId: string, meta: SessionMeta = {}) {
  const { plain, hash } = generateRefreshToken();
  const session = await prisma.sesion.create({
    data: {
      usuarioId,
      refreshTokenHash: hash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });
  return { session, refreshToken: plain };
}

export type RotateSessionResult =
  | { ok: true; session: Awaited<ReturnType<typeof createSession>>["session"]; refreshToken: string; usuarioId: string }
  | { ok: false; reason: "not_found" | "expired" | "revoked" };

/**
 * Rota el refresh token: revoca el actual y emite uno nuevo. Si el token
 * presentado ya estaba revocado, es indicio de robo/replay (alguien reutilizó
 * un token viejo) y se revocan todas las sesiones del usuario como respuesta.
 */
export async function rotateSession(plainRefreshToken: string, meta: SessionMeta = {}): Promise<RotateSessionResult> {
  const hash = hashRefreshToken(plainRefreshToken);
  const existing = await prisma.sesion.findUnique({ where: { refreshTokenHash: hash } });

  if (!existing) {
    return { ok: false, reason: "not_found" };
  }

  if (existing.revokedAt) {
    await revokeAllSessionsForUser(existing.usuarioId);
    return { ok: false, reason: "revoked" };
  }

  if (existing.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const next = generateRefreshToken();
  const [, created] = await prisma.$transaction([
    prisma.sesion.update({ where: { id: existing.id }, data: { revokedAt: new Date() } }),
    prisma.sesion.create({
      data: {
        usuarioId: existing.usuarioId,
        refreshTokenHash: next.hash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
      },
    }),
  ]);

  return { ok: true, session: created, refreshToken: next.plain, usuarioId: existing.usuarioId };
}

export async function revokeSession(sessionId: string) {
  await prisma.sesion.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
}

/** Usado por logout: revoca por el token que trae la cookie, sin necesidad de
 * conocer de antemano el id de la sesión. No falla si el token ya no existe
 * (logout de una sesión ya vencida/revocada debe ser un no-op silencioso). */
export async function revokeSessionByRefreshToken(plainRefreshToken: string): Promise<void> {
  const hash = hashRefreshToken(plainRefreshToken);
  await prisma.sesion.updateMany({ where: { refreshTokenHash: hash, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessionsForUser(usuarioId: string) {
  await prisma.sesion.updateMany({
    where: { usuarioId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

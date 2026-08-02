import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "../env";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutos: corto a propósito, se renueva con el refresh token

export interface AccessTokenClaims extends JWTPayload {
  sub: string; // usuarioId
  tenantId: string | null;
  esSuperAdminSaas: boolean;
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function signAccessToken(claims: Omit<AccessTokenClaims, "iat" | "exp">): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== "string" || typeof payload.esSuperAdminSaas !== "boolean") {
      return null;
    }
    const tenantId = payload.tenantId;
    if (tenantId !== null && typeof tenantId !== "string") {
      return null;
    }
    return payload as AccessTokenClaims;
  } catch {
    return null;
  }
}

export const ACCESS_TOKEN_TTL_MS = ACCESS_TOKEN_TTL_SECONDS * 1000;

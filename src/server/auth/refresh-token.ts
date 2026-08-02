import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

/** Token opaco de alta entropía. No es un secreto derivable, así que hashearlo
 * con SHA-256 (en vez de argon2) alcanza para que un dump de la tabla `sesiones`
 * no entregue tokens usables. */
export function generateRefreshToken(): { plain: string; hash: string } {
  const plain = randomBytes(32).toString("base64url");
  return { plain, hash: hashRefreshToken(plain) };
}

export function hashRefreshToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export function refreshTokenHashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

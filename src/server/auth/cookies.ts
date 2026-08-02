import { cookies } from "next/headers";
import { ACCESS_TOKEN_TTL_MS } from "./tokens";
import { REFRESH_TOKEN_TTL_MS } from "./refresh-token";

export const ACCESS_TOKEN_COOKIE = "mf_access";
export const REFRESH_TOKEN_COOKIE = "mf_refresh";

const isProduction = process.env.NODE_ENV === "production";

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_MS / 1000,
  });
  store.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    // Restringido a las rutas de auth: el refresh token no necesita viajar en
    // cada request de la app, sólo cuando se pide renovar o cerrar sesión.
    path: "/api/auth",
    maxAge: REFRESH_TOKEN_TTL_MS / 1000,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete({ name: ACCESS_TOKEN_COOKIE, path: "/" });
  store.delete({ name: REFRESH_TOKEN_COOKIE, path: "/api/auth" });
}

export async function getAccessTokenCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function getRefreshTokenCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_TOKEN_COOKIE)?.value;
}

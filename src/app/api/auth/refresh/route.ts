import { NextResponse, type NextRequest } from "next/server";
import { refreshAccessToken } from "@/server/auth/refresh-service";
import { getRefreshTokenCookie, setAuthCookies, clearAuthCookies } from "@/server/auth/cookies";

export async function POST(request: NextRequest) {
  const refreshToken = await getRefreshTokenCookie();
  if (!refreshToken) {
    return NextResponse.json({ error: "no_session", message: "No hay sesión activa." }, { status: 401 });
  }

  const result = await refreshAccessToken(refreshToken, {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  if (!result.ok) {
    await clearAuthCookies();
    return NextResponse.json({ error: result.reason, message: "La sesión venció o es inválida. Iniciá sesión de nuevo." }, { status: 401 });
  }

  await setAuthCookies(result.accessToken, result.refreshToken);
  return NextResponse.json({ ok: true });
}

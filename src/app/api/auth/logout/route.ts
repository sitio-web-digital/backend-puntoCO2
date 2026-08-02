import { NextResponse } from "next/server";
import { getRefreshTokenCookie, clearAuthCookies } from "@/server/auth/cookies";
import { revokeSessionByRefreshToken } from "@/server/auth/session-service";

export async function POST() {
  const refreshToken = await getRefreshTokenCookie();
  if (refreshToken) {
    await revokeSessionByRefreshToken(refreshToken);
  }
  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}

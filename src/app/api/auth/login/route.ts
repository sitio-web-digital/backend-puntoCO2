import { NextResponse, type NextRequest } from "next/server";
import { login, loginSchema } from "@/server/auth/login-service";
import { setAuthCookies } from "@/server/auth/cookies";
import { checkRateLimit } from "@/server/security/rate-limit";

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Cuerpo de la petición inválido." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", message: "Datos de login inválidos.", details: parsed.error.issues }, { status: 400 });
  }

  // Limitamos por ip+email para no bloquear a todos los usuarios de una
  // empresa por los intentos fallidos de una sola cuenta, ni viceversa.
  const rateLimitKey = `login:${ip}:${parsed.data.email.toLowerCase()}`;
  const rateLimit = checkRateLimit(rateLimitKey, { maxAttempts: 5, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "too_many_attempts", message: "Demasiados intentos. Probá de nuevo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } },
    );
  }

  const result = await login(parsed.data, { ipAddress: ip, userAgent: request.headers.get("user-agent") ?? undefined });

  if (!result.ok) {
    const status = result.reason === "tenant_inactive" ? 403 : 401;
    const message = result.reason === "tenant_inactive" ? "La cuenta de tu empresa no está activa." : "Email o contraseña incorrectos.";
    return NextResponse.json({ error: result.reason, message }, { status });
  }

  await setAuthCookies(result.accessToken, result.refreshToken);
  return NextResponse.json({ usuario: result.usuario });
}

/**
 * Rate limiter de ventana fija, en memoria del proceso. Sirve como primera
 * línea de defensa contra fuerza bruta en login mientras el despliegue es de
 * una sola instancia. Si en algún momento se escala horizontalmente, esto
 * deja de ser válido entre instancias (cada una cuenta por separado) y hay
 * que reemplazarlo por un backend compartido (Redis).
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= options.maxAttempts) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

/** Sólo para tests: evita que el estado de un rate limit se filtre entre casos. */
export function resetRateLimitsForTests(): void {
  buckets.clear();
}

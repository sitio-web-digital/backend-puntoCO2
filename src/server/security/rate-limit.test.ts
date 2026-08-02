import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetRateLimitsForTests } from "./rate-limit";

describe("rate limiter de ventana fija", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRateLimitsForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite hasta maxAttempts dentro de la ventana", () => {
    const key = "ip-1:user@example.com";
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, { maxAttempts: 5, windowMs: 60_000 }).allowed).toBe(true);
    }
  });

  it("bloquea el intento que excede maxAttempts", () => {
    const key = "ip-2:user@example.com";
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, { maxAttempts: 5, windowMs: 60_000 });
    }
    const sexto = checkRateLimit(key, { maxAttempts: 5, windowMs: 60_000 });
    expect(sexto.allowed).toBe(false);
    expect(sexto.retryAfterMs).toBeGreaterThan(0);
  });

  it("resetea el conteo una vez que pasa la ventana de tiempo", () => {
    const key = "ip-3:user@example.com";
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, { maxAttempts: 5, windowMs: 60_000 });
    }
    expect(checkRateLimit(key, { maxAttempts: 5, windowMs: 60_000 }).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(checkRateLimit(key, { maxAttempts: 5, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("no mezcla los contadores de distintas claves", () => {
    const keyA = "ip-4:a@example.com";
    const keyB = "ip-4:b@example.com";
    for (let i = 0; i < 5; i++) {
      checkRateLimit(keyA, { maxAttempts: 5, windowMs: 60_000 });
    }
    expect(checkRateLimit(keyA, { maxAttempts: 5, windowMs: 60_000 }).allowed).toBe(false);
    expect(checkRateLimit(keyB, { maxAttempts: 5, windowMs: 60_000 }).allowed).toBe(true);
  });
});

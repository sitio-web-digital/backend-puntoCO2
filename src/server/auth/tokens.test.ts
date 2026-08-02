import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "./tokens";

describe("access tokens", () => {
  it("firma y verifica un token válido, preservando sus claims", async () => {
    const token = await signAccessToken({ sub: "user_1", tenantId: "tenant_1", esSuperAdminSaas: false });
    const claims = await verifyAccessToken(token);
    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe("user_1");
    expect(claims?.tenantId).toBe("tenant_1");
    expect(claims?.esSuperAdminSaas).toBe(false);
  });

  it("admite tenantId null para el superadmin SaaS", async () => {
    const token = await signAccessToken({ sub: "admin_1", tenantId: null, esSuperAdminSaas: true });
    const claims = await verifyAccessToken(token);
    expect(claims?.tenantId).toBeNull();
    expect(claims?.esSuperAdminSaas).toBe(true);
  });

  it("rechaza un token manipulado", async () => {
    const token = await signAccessToken({ sub: "user_1", tenantId: "tenant_1", esSuperAdminSaas: false });
    const tampered = token.slice(0, -2) + (token.endsWith("A") ? "B" : "A");
    await expect(verifyAccessToken(tampered)).resolves.toBeNull();
  });

  it("rechaza un token con firma de otro secreto", async () => {
    const { SignJWT } = await import("jose");
    const foreignSecret = new TextEncoder().encode("otro-secreto-de-32-caracteres-min");
    const foreignToken = await new SignJWT({ sub: "attacker", tenantId: null, esSuperAdminSaas: true })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(foreignSecret);
    await expect(verifyAccessToken(foreignToken)).resolves.toBeNull();
  });

  it("rechaza basura que no es un JWT", async () => {
    await expect(verifyAccessToken("no-soy-un-token")).resolves.toBeNull();
  });
});

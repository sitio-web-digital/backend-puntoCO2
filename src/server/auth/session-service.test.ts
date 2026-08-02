import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { createSession, revokeAllSessionsForUser, revokeSession, revokeSessionByRefreshToken, rotateSession } from "./session-service";
import { hashRefreshToken } from "./refresh-token";

describe("gestión de sesiones (refresh tokens)", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.sesion.deleteMany({ where: { usuario: { tenantId } } });
        await tx.usuarioRol.deleteMany({ where: { rol: { tenantId } } });
        await tx.usuario.deleteMany({ where: { tenantId } });
        await tx.rolPermiso.deleteMany({ where: { rol: { tenantId } } });
        await tx.rol.deleteMany({ where: { tenantId } });
      });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    createdTenantIds.length = 0;
  });

  async function createUsuario() {
    const unique = randomUUID().slice(0, 8);
    const { tenant, usuarioAdmin } = await createTenant(
      {
        nombre: `Sesiones Test ${unique}`,
        slug: `sesiones-test-${unique}`,
        adminEmail: `admin-${unique}@example.com`,
        adminPassword: "clave-de-prueba-segura-123",
        adminNombre: "Ada",
        adminApellido: "Admin",
      },
      { usuarioId: null },
    );
    createdTenantIds.push(tenant.id);
    return usuarioAdmin;
  }

  it("createSession persiste el hash, nunca el token en texto plano", async () => {
    const usuario = await createUsuario();
    const { session, refreshToken } = await createSession(usuario.id);

    expect(session.refreshTokenHash).not.toBe(refreshToken);
    expect(session.refreshTokenHash).toBe(hashRefreshToken(refreshToken));
  });

  it("rotateSession emite un token nuevo y revoca el anterior", async () => {
    const usuario = await createUsuario();
    const { refreshToken: original } = await createSession(usuario.id);

    const rotated = await rotateSession(original);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;
    expect(rotated.refreshToken).not.toBe(original);

    const originalSesion = await prisma.sesion.findUnique({ where: { refreshTokenHash: hashRefreshToken(original) } });
    expect(originalSesion?.revokedAt).not.toBeNull();
  });

  it("rechaza rotar un token que no existe", async () => {
    const result = await rotateSession("token-que-nunca-existio");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("rechaza rotar un token vencido", async () => {
    const usuario = await createUsuario();
    const { session, refreshToken } = await createSession(usuario.id);
    await prisma.sesion.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const result = await rotateSession(refreshToken);
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("detecta reuso de un token ya revocado y revoca TODAS las sesiones del usuario (posible robo)", async () => {
    const usuario = await createUsuario();
    const { refreshToken: tokenA } = await createSession(usuario.id);
    const { refreshToken: tokenB } = await createSession(usuario.id);

    // Rotamos A: queda revocado y se emite uno nuevo.
    const firstRotation = await rotateSession(tokenA);
    expect(firstRotation.ok).toBe(true);

    // Alguien reutiliza el token A viejo (ya revocado): tratamos esto como robo.
    const reuse = await rotateSession(tokenA);
    expect(reuse).toEqual({ ok: false, reason: "revoked" });

    // Efecto: la sesión B, que era legítima y seguía activa, también queda revocada.
    const sesionB = await prisma.sesion.findUnique({ where: { refreshTokenHash: hashRefreshToken(tokenB) } });
    expect(sesionB?.revokedAt).not.toBeNull();
  });

  it("revokeSession invalida una sesión puntual por id", async () => {
    const usuario = await createUsuario();
    const { session } = await createSession(usuario.id);
    await revokeSession(session.id);

    const actualizado = await prisma.sesion.findUnique({ where: { id: session.id } });
    expect(actualizado?.revokedAt).not.toBeNull();
  });

  it("revokeSessionByRefreshToken invalida por el valor de la cookie, sin conocer el id de sesión", async () => {
    const usuario = await createUsuario();
    const { refreshToken } = await createSession(usuario.id);

    await revokeSessionByRefreshToken(refreshToken);

    const sesion = await prisma.sesion.findUnique({ where: { refreshTokenHash: hashRefreshToken(refreshToken) } });
    expect(sesion?.revokedAt).not.toBeNull();
  });

  it("revokeSessionByRefreshToken con un token inexistente no lanza (logout de sesión ya vencida es un no-op)", async () => {
    await expect(revokeSessionByRefreshToken("token-inexistente")).resolves.toBeUndefined();
  });

  it("revokeAllSessionsForUser cierra todas las sesiones activas del usuario", async () => {
    const usuario = await createUsuario();
    const { refreshToken: tokenA } = await createSession(usuario.id);
    const { refreshToken: tokenB } = await createSession(usuario.id);

    await revokeAllSessionsForUser(usuario.id);

    const sesionA = await prisma.sesion.findUnique({ where: { refreshTokenHash: hashRefreshToken(tokenA) } });
    const sesionB = await prisma.sesion.findUnique({ where: { refreshTokenHash: hashRefreshToken(tokenB) } });
    expect(sesionA?.revokedAt).not.toBeNull();
    expect(sesionB?.revokedAt).not.toBeNull();
  });
});

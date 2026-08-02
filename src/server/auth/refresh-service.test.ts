import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { createSession } from "./session-service";
import { refreshAccessToken } from "./refresh-service";
import { verifyAccessToken } from "./tokens";

describe("refresh de access token (RF-27)", () => {
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
        nombre: `Refresh Test ${unique}`,
        slug: `refresh-test-${unique}`,
        adminEmail: `admin-${unique}@example.com`,
        adminPassword: "clave-de-prueba-segura-123",
        adminNombre: "Ada",
        adminApellido: "Admin",
      },
      { usuarioId: null },
    );
    createdTenantIds.push(tenant.id);
    return { tenant, usuarioAdmin };
  }

  it("emite un access token nuevo con el tenantId correcto y rota el refresh token", async () => {
    const { tenant, usuarioAdmin } = await createUsuario();
    const { refreshToken } = await createSession(usuarioAdmin.id);

    const result = await refreshAccessToken(refreshToken);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.refreshToken).not.toBe(refreshToken);

    const claims = await verifyAccessToken(result.accessToken);
    expect(claims?.sub).toBe(usuarioAdmin.id);
    expect(claims?.tenantId).toBe(tenant.id);
  });

  it("rechaza un refresh token inválido o inexistente", async () => {
    const result = await refreshAccessToken("token-que-no-existe");
    expect(result).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rechaza el refresh si el usuario fue suspendido después de emitido el token", async () => {
    const { tenant, usuarioAdmin } = await createUsuario();
    const { refreshToken } = await createSession(usuarioAdmin.id);

    await withTenant({ tenantId: tenant.id }, (tx) => tx.usuario.update({ where: { id: usuarioAdmin.id }, data: { estado: "SUSPENDIDO" } }));

    const result = await refreshAccessToken(refreshToken);
    expect(result).toEqual({ ok: false, reason: "user_inactive" });
  });
});

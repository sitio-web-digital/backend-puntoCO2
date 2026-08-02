import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { hashPassword } from "./password";
import { login } from "./login-service";
import { verifyAccessToken } from "./tokens";
import { hashRefreshToken } from "./refresh-token";

describe("login (RF-27)", () => {
  const createdTenantIds: string[] = [];
  const createdSuperAdminIds: string[] = [];

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

    for (const id of createdSuperAdminIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.sesion.deleteMany({ where: { usuarioId: id } });
        await tx.usuario.delete({ where: { id } });
      });
    }
    createdSuperAdminIds.length = 0;
  });

  async function setupTenantWithAdmin(password = "clave-de-prueba-segura-123") {
    const unique = randomUUID().slice(0, 8);
    const { tenant, usuarioAdmin } = await createTenant(
      {
        nombre: `Matafuegos Login ${unique}`,
        slug: `matafuegos-login-${unique}`,
        adminEmail: `admin-${unique}@example.com`,
        adminPassword: password,
        adminNombre: "Ada",
        adminApellido: "Admin",
      },
      { usuarioId: null },
    );
    createdTenantIds.push(tenant.id);
    return { tenant, usuarioAdmin, password };
  }

  async function createSuperAdmin(password = "clave-superadmin-segura-123") {
    const unique = randomUUID().slice(0, 8);
    const passwordHash = await hashPassword(password);
    const usuario = await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
      tx.usuario.create({
        data: {
          tenantId: null,
          email: `superadmin-${unique}@example.com`,
          passwordHash,
          nombre: "Sofía",
          apellido: "Super",
          esSuperAdminSaas: true,
        },
      }),
    );
    createdSuperAdminIds.push(usuario.id);
    return { usuario, password };
  }

  it("loguea correctamente con slug + email + password válidos y emite tokens usables", async () => {
    const { tenant, usuarioAdmin, password } = await setupTenantWithAdmin();

    const result = await login({ slug: tenant.slug, email: usuarioAdmin.email, password });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usuario.tenantId).toBe(tenant.id);
    expect(result.usuario.esSuperAdminSaas).toBe(false);

    const claims = await verifyAccessToken(result.accessToken);
    expect(claims?.sub).toBe(usuarioAdmin.id);
    expect(claims?.tenantId).toBe(tenant.id);

    const sesion = await prisma.sesion.findUnique({ where: { refreshTokenHash: hashRefreshToken(result.refreshToken) } });
    expect(sesion?.usuarioId).toBe(usuarioAdmin.id);
  });

  it("rechaza una contraseña incorrecta sin distinguir el motivo", async () => {
    const { tenant, usuarioAdmin } = await setupTenantWithAdmin();
    const result = await login({ slug: tenant.slug, email: usuarioAdmin.email, password: "password-incorrecta" });
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("un slug inexistente da el mismo error genérico que una contraseña incorrecta (no revela qué empresas existen)", async () => {
    const result = await login({ slug: "empresa-que-no-existe-nunca", email: "quien@example.com", password: "cualquiera" });
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("un email inexistente dentro de un tenant válido da el mismo error genérico", async () => {
    const { tenant } = await setupTenantWithAdmin();
    const result = await login({ slug: tenant.slug, email: "no-existe@example.com", password: "cualquiera" });
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("bloquea el login si el tenant está suspendido, aunque las credenciales sean correctas", async () => {
    const { tenant, usuarioAdmin, password } = await setupTenantWithAdmin();
    await prisma.tenant.update({ where: { id: tenant.id }, data: { estado: "SUSPENDIDO" } });

    const result = await login({ slug: tenant.slug, email: usuarioAdmin.email, password });
    expect(result).toEqual({ ok: false, reason: "tenant_inactive" });
  });

  it("bloquea el login de un usuario suspendido dentro de un tenant activo", async () => {
    const { tenant, usuarioAdmin, password } = await setupTenantWithAdmin();
    await withTenant({ tenantId: tenant.id }, (tx) => tx.usuario.update({ where: { id: usuarioAdmin.id }, data: { estado: "SUSPENDIDO" } }));

    const result = await login({ slug: tenant.slug, email: usuarioAdmin.email, password });
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("permite el login del superadmin SaaS sin slug", async () => {
    const { usuario, password } = await createSuperAdmin();
    const result = await login({ email: usuario.email, password });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usuario.tenantId).toBeNull();
    expect(result.usuario.esSuperAdminSaas).toBe(true);
  });

  it("un usuario normal de un tenant no puede loguearse por el camino de superadmin (sin slug)", async () => {
    const { usuarioAdmin, password } = await setupTenantWithAdmin();
    const result = await login({ email: usuarioAdmin.email, password });
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });
});

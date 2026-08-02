import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant, SlugAlreadyExistsError } from "./provisioning";

describe("alta de tenant (RF-28)", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.usuarioRol.deleteMany({ where: { rol: { tenantId } } });
        await tx.usuario.deleteMany({ where: { tenantId } });
        await tx.rolPermiso.deleteMany({ where: { rol: { tenantId } } });
        await tx.rol.deleteMany({ where: { tenantId } });
      });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    createdTenantIds.length = 0;
  });

  function buildInput(overrides: Partial<Parameters<typeof createTenant>[0]> = {}) {
    const unique = randomUUID().slice(0, 8);
    return {
      nombre: `Matafuegos Test ${unique}`,
      slug: `matafuegos-test-${unique}`,
      adminEmail: `admin-${unique}@example.com`,
      adminPassword: "clave-de-prueba-segura-123",
      adminNombre: "Ada",
      adminApellido: "Admin",
      ...overrides,
    };
  }

  it("crea el tenant, sus 9 roles por defecto y el usuario administrador con el rol correcto", async () => {
    const input = buildInput();
    const { tenant, usuarioAdmin } = await createTenant(input, { usuarioId: null });
    createdTenantIds.push(tenant.id);

    expect(tenant.estado).toBe("TRIAL");
    expect(usuarioAdmin.email).toBe(input.adminEmail);

    const roles = await withTenant({ tenantId: tenant.id }, (tx) => tx.rol.findMany({ include: { permisos: true } }));
    expect(roles).toHaveLength(9);
    expect(roles.map((r) => r.nombre)).toContain("Administrador de empresa");

    const rolAdmin = roles.find((r) => r.nombre === "Administrador de empresa")!;
    const permisoClientesEditar = rolAdmin.permisos.find((p) => p.recurso === "CLIENTES" && p.accion === "EDITAR");
    expect(permisoClientesEditar?.alcance).toBe("TODAS");

    const asignacion = await withTenant({ tenantId: tenant.id }, (tx) =>
      tx.usuarioRol.findFirst({ where: { usuarioId: usuarioAdmin.id }, include: { rol: true } }),
    );
    expect(asignacion?.rol.nombre).toBe("Administrador de empresa");
  });

  it("hashea la contraseña del administrador (nunca la guarda en texto plano)", async () => {
    const input = buildInput();
    const { tenant, usuarioAdmin } = await createTenant(input, { usuarioId: null });
    createdTenantIds.push(tenant.id);

    expect(usuarioAdmin.passwordHash).not.toBe(input.adminPassword);
    expect(usuarioAdmin.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  it("rechaza un slug duplicado sin dejar un tenant a medio crear", async () => {
    const input = buildInput();
    const { tenant } = await createTenant(input, { usuarioId: null });
    createdTenantIds.push(tenant.id);

    await expect(createTenant(buildInput({ slug: input.slug }), { usuarioId: null })).rejects.toThrow(SlugAlreadyExistsError);
  });

  it("rechaza un slug con formato inválido antes de tocar la base", async () => {
    await expect(createTenant(buildInput({ slug: "No Valido!" }), { usuarioId: null })).rejects.toThrow();
  });

  it("rechaza una contraseña de administrador demasiado corta", async () => {
    await expect(createTenant(buildInput({ adminPassword: "corta" }), { usuarioId: null })).rejects.toThrow();
  });

  it("los roles de un tenant no son visibles para otro (aislamiento también en RBAC)", async () => {
    const { tenant: tenantA } = await createTenant(buildInput(), { usuarioId: null });
    const { tenant: tenantB } = await createTenant(buildInput(), { usuarioId: null });
    createdTenantIds.push(tenantA.id, tenantB.id);

    const rolesVisiblesDesdeA = await withTenant({ tenantId: tenantA.id }, (tx) => tx.rol.findMany());
    expect(rolesVisiblesDesdeA.every((r) => r.tenantId === tenantA.id)).toBe(true);
    expect(rolesVisiblesDesdeA.some((r) => r.tenantId === tenantB.id)).toBe(false);
  });
});

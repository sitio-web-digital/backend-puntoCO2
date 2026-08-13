import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import {
  listTenantsPlataforma,
  getTenantPlataforma,
  crearTenantPlataforma,
  suspenderTenantPlataforma,
  reactivarTenantPlataforma,
  cambiarEstadoTenantPlataforma,
  marcarPagoTenant,
  resumenPlataforma,
  TenantNotFoundError,
  type PlatformActor,
} from "./service";
import { login } from "../auth/login-service";

describe("panel de plataforma (superadmin SaaS)", () => {
  const createdTenantIds: string[] = [];
  const superAdminActor: PlatformActor = { usuarioId: "test-superadmin" };

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.usuarioRol.deleteMany({ where: { rol: { tenantId } } });
        await tx.usuario.deleteMany({ where: { tenantId } });
        await tx.rolPermiso.deleteMany({ where: { rol: { tenantId } } });
        await tx.rol.deleteMany({ where: { tenantId } });
        await tx.auditLog.deleteMany({ where: { tenantId } });
      });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    createdTenantIds.length = 0;
  });

  function buildInput(overrides: Partial<Parameters<typeof createTenant>[0]> = {}) {
    const unique = randomUUID().slice(0, 8);
    return {
      nombre: `Plataforma Test ${unique}`,
      slug: `plataforma-test-${unique}`,
      adminEmail: `admin-${unique}@example.com`,
      adminPassword: "clave-de-prueba-segura-123",
      adminNombre: "Ada",
      adminApellido: "Admin",
      ...overrides,
    };
  }

  async function crearTenantDePrueba(overrides: Parameters<typeof buildInput>[0] = {}) {
    const { tenant, usuarioAdmin } = await createTenant(buildInput(overrides), { usuarioId: null });
    createdTenantIds.push(tenant.id);
    return { tenant, usuarioAdmin };
  }

  it("crearTenantPlataforma da de alta una empresa nueva utilizable de inmediato", async () => {
    const input = buildInput();
    const { tenant, usuarioAdmin } = await crearTenantPlataforma(superAdminActor, input);
    createdTenantIds.push(tenant.id);

    expect(tenant.slug).toBe(input.slug);
    expect(tenant.estado).toBe("TRIAL");
    expect(usuarioAdmin.email).toBe(input.adminEmail);
    expect(usuarioAdmin).not.toHaveProperty("passwordHash");
  });

  it("listTenantsPlataforma trae empresas de todos los tenants con sus contadores", async () => {
    const { tenant: tenantA } = await crearTenantDePrueba();
    const { tenant: tenantB } = await crearTenantDePrueba();

    const pagina = await listTenantsPlataforma(superAdminActor, { pageSize: 100 });

    const ids = pagina.items.map((t) => t.id);
    expect(ids).toContain(tenantA.id);
    expect(ids).toContain(tenantB.id);
    const encontrado = pagina.items.find((t) => t.id === tenantA.id);
    expect(encontrado?._count.usuarios).toBe(1); // el admin creado junto con el tenant
  });

  it("getTenantPlataforma trae el detalle con usuarios activos, sin exponer el hash", async () => {
    const { tenant, usuarioAdmin } = await crearTenantDePrueba();

    const detalle = await getTenantPlataforma(superAdminActor, tenant.id);

    expect(detalle.id).toBe(tenant.id);
    expect(detalle.usuarios).toHaveLength(1);
    expect(detalle.usuarios[0]?.id).toBe(usuarioAdmin.id);
    expect(detalle.usuarios[0]).not.toHaveProperty("passwordHash");
  });

  it("lanza TenantNotFoundError sobre un id inexistente", async () => {
    await expect(getTenantPlataforma(superAdminActor, "no-existe")).rejects.toThrow(TenantNotFoundError);
  });

  it("suspenderTenantPlataforma cambia el estado e impide el login de sus usuarios", async () => {
    const { tenant, usuarioAdmin } = await crearTenantDePrueba();

    const suspendido = await suspenderTenantPlataforma(superAdminActor, tenant.id, "falta de pago");
    expect(suspendido.estado).toBe("SUSPENDIDO");

    // Contraseña correcta: lo que tiene que bloquear el login es el estado
    // del tenant (tenant_inactive), no una credencial inválida.
    const intentoLogin = await login({ slug: tenant.slug, email: usuarioAdmin.email, password: "clave-de-prueba-segura-123" });
    expect(intentoLogin.ok).toBe(false);
    if (!intentoLogin.ok) expect(intentoLogin.reason).toBe("tenant_inactive");
  });

  it("reactivarTenantPlataforma vuelve a permitir el login tras una suspensión", async () => {
    const { tenant, usuarioAdmin } = await crearTenantDePrueba();

    await suspenderTenantPlataforma(superAdminActor, tenant.id);
    const reactivado = await reactivarTenantPlataforma(superAdminActor, tenant.id);
    expect(reactivado.estado).toBe("ACTIVO");

    const intentoLogin = await login({ slug: tenant.slug, email: usuarioAdmin.email, password: "clave-de-prueba-segura-123" });
    expect(intentoLogin.ok).toBe(true);
  });

  it("cambiarEstadoTenantPlataforma promueve una empresa TRIAL a ACTIVO", async () => {
    const { tenant, usuarioAdmin } = await crearTenantDePrueba();
    expect(tenant.estado).toBe("TRIAL");

    const activado = await cambiarEstadoTenantPlataforma(superAdminActor, tenant.id, "ACTIVO");
    expect(activado.estado).toBe("ACTIVO");

    const intentoLogin = await login({ slug: tenant.slug, email: usuarioAdmin.email, password: "clave-de-prueba-segura-123" });
    expect(intentoLogin.ok).toBe(true);
  });

  it("cambiarEstadoTenantPlataforma rechaza un estado inválido", async () => {
    const { tenant } = await crearTenantDePrueba();
    // @ts-expect-error probando un valor fuera del enum a propósito
    await expect(cambiarEstadoTenantPlataforma(superAdminActor, tenant.id, "NO_EXISTE")).rejects.toThrow();
  });

  it("registra auditoría del cambio de estado con motivo", async () => {
    const { tenant } = await crearTenantDePrueba();
    await suspenderTenantPlataforma(superAdminActor, tenant.id, "prueba de auditoría");

    const logs = await withTenant({ tenantId: tenant.id }, (tx) =>
      tx.auditLog.findMany({ where: { entidad: "Tenant", entidadId: tenant.id, accion: "STATUS_CHANGE" } }),
    );

    expect(logs).toHaveLength(1);
    expect(logs[0]?.motivo).toBe("prueba de auditoría");
  });

  it("marcarPagoTenant activa la empresa y extiende la vigencia 30 días, limpiando vencidoDesde", async () => {
    const { tenant, usuarioAdmin } = await crearTenantDePrueba();
    const haceTresDias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await prisma.tenant.update({ where: { id: tenant.id }, data: { estado: "VENCIDO", vencidoDesde: haceTresDias, vigenciaHasta: haceTresDias } });

    const actualizado = await marcarPagoTenant(superAdminActor, tenant.id, "transferencia recibida");

    expect(actualizado.estado).toBe("ACTIVO");
    expect(actualizado.vencidoDesde).toBeNull();
    expect(actualizado.vigenciaHasta).not.toBeNull();
    expect(actualizado.vigenciaHasta!.getTime()).toBeGreaterThan(Date.now() + 25 * 24 * 60 * 60 * 1000);

    const intentoLogin = await login({ slug: tenant.slug, email: usuarioAdmin.email, password: "clave-de-prueba-segura-123" });
    expect(intentoLogin.ok).toBe(true);
  });

  it("getTenantPlataforma refleja el vencimiento automático al leer una empresa con la vigencia vencida", async () => {
    const { tenant } = await crearTenantDePrueba();
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.tenant.update({ where: { id: tenant.id }, data: { vigenciaHasta: ayer } });

    const detalle = await getTenantPlataforma(superAdminActor, tenant.id);

    expect(detalle.estado).toBe("VENCIDO");
  });

  it("listTenantsPlataforma refleja el vencimiento automático de varias empresas al listarlas", async () => {
    const { tenant } = await crearTenantDePrueba();
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.tenant.update({ where: { id: tenant.id }, data: { vigenciaHasta: ayer } });

    const pagina = await listTenantsPlataforma(superAdminActor, { pageSize: 100 });

    const encontrado = pagina.items.find((t) => t.id === tenant.id);
    expect(encontrado?.estado).toBe("VENCIDO");
  });

  it("resumenPlataforma cuenta empresas por estado", async () => {
    const { tenant } = await crearTenantDePrueba();
    await suspenderTenantPlataforma(superAdminActor, tenant.id);

    const resumen = await resumenPlataforma();

    expect(resumen.totalEmpresas).toBeGreaterThanOrEqual(1);
    expect(resumen.conteoPorEstado.SUSPENDIDO).toBeGreaterThanOrEqual(1);
  });
});

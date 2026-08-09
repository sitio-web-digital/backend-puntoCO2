import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { aplicarVencimientoTenant, aplicarVencimientosPendientes } from "./vencimientos";

describe("motor de vencimiento automático de suscripción", () => {
  const createdTenantIds: string[] = [];

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

  async function crearTenantDePrueba(overrides: Partial<Parameters<typeof createTenant>[0]> = {}) {
    const unique = randomUUID().slice(0, 8);
    const { tenant } = await createTenant(
      {
        nombre: `Vencimiento Test ${unique}`,
        slug: `vencimiento-test-${unique}`,
        adminEmail: `admin-${unique}@example.com`,
        adminPassword: "clave-de-prueba-segura-123",
        adminNombre: "Ada",
        adminApellido: "Admin",
        ...overrides,
      },
      { usuarioId: null },
    );
    createdTenantIds.push(tenant.id);
    return tenant;
  }

  it("crearTenant fija vigenciaHasta según trialDias", async () => {
    const antes = Date.now();
    const tenant = await crearTenantDePrueba({ trialDias: 7 });
    expect(tenant.vigenciaHasta).not.toBeNull();
    const diffDias = (tenant.vigenciaHasta!.getTime() - antes) / (24 * 60 * 60 * 1000);
    expect(diffDias).toBeGreaterThan(6.9);
    expect(diffDias).toBeLessThan(7.1);
  });

  it("pasa de TRIAL a VENCIDO cuando se pasó vigenciaHasta", async () => {
    const tenant = await crearTenantDePrueba();
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.tenant.update({ where: { id: tenant.id }, data: { vigenciaHasta: ayer } });

    const estado = await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
      aplicarVencimientoTenant(tx, { id: tenant.id, estado: "TRIAL", vigenciaHasta: ayer, vencidoDesde: null }),
    );

    expect(estado).toBe("VENCIDO");
    const actualizado = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(actualizado?.estado).toBe("VENCIDO");
    expect(actualizado?.vencidoDesde).not.toBeNull();
  });

  it("no toca un tenant TRIAL cuya vigencia todavía no venció", async () => {
    const tenant = await crearTenantDePrueba({ trialDias: 14 });

    const estado = await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
      aplicarVencimientoTenant(tx, { id: tenant.id, estado: "TRIAL", vigenciaHasta: tenant.vigenciaHasta, vencidoDesde: null }),
    );

    expect(estado).toBe("TRIAL");
  });

  it("pasa de VENCIDO a SUSPENDIDO recién después de 2 días de gracia, no antes", async () => {
    const tenant = await crearTenantDePrueba();
    const haceUnDia = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    await prisma.tenant.update({ where: { id: tenant.id }, data: { estado: "VENCIDO", vencidoDesde: haceUnDia } });

    const estadoDentroDeGracia = await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
      aplicarVencimientoTenant(tx, { id: tenant.id, estado: "VENCIDO", vigenciaHasta: null, vencidoDesde: haceUnDia }),
    );
    expect(estadoDentroDeGracia).toBe("VENCIDO");

    const haceTresDias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await prisma.tenant.update({ where: { id: tenant.id }, data: { vencidoDesde: haceTresDias } });

    const estadoFueraDeGracia = await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
      aplicarVencimientoTenant(tx, { id: tenant.id, estado: "VENCIDO", vigenciaHasta: null, vencidoDesde: haceTresDias }),
    );
    expect(estadoFueraDeGracia).toBe("SUSPENDIDO");

    const actualizado = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(actualizado?.estado).toBe("SUSPENDIDO");
  });

  it("no toca empresas ACTIVAS ni CANCELADAS sin vigenciaHasta vencida", async () => {
    const tenant = await crearTenantDePrueba();
    const enUnMes = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.tenant.update({ where: { id: tenant.id }, data: { estado: "ACTIVO", vigenciaHasta: enUnMes } });

    await withTenant({ tenantId: null, bypassRls: true }, (tx) => aplicarVencimientosPendientes(tx));

    const actualizado = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(actualizado?.estado).toBe("ACTIVO");
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { createCliente, type TenantActor } from "../clientes/service";
import { createEstablecimiento } from "../establecimientos/service";
import { buildXlsxBuffer } from "../import/test-helpers";
import { importarMatafuegos } from "./import";
import { listMatafuegos } from "./service";

const HEADERS = [
  "Código interno",
  "N° de serie",
  "Código de barras (opcional)",
  "Tipo",
  "Agente extintor",
  "Capacidad nominal (opcional)",
  "Marca (opcional)",
  "Modelo (opcional)",
  "Fabricante (opcional)",
  "Fecha de fabricación (opcional, AAAA-MM-DD)",
  "Fecha de puesta en servicio (opcional, AAAA-MM-DD)",
  "Peso nominal en kg (opcional)",
  "Norma técnica (opcional)",
  "Observaciones (opcional)",
];

function filaMatafuego(overrides: Partial<Record<string, string>> = {}): string[] {
  const valores: Record<string, string> = {
    "Código interno": "MAT-0001",
    "N° de serie": "AR-00001",
    "Código de barras (opcional)": "",
    Tipo: "Portátil",
    "Agente extintor": "Polvo químico ABC",
    "Capacidad nominal (opcional)": "5kg",
    "Marca (opcional)": "",
    "Modelo (opcional)": "",
    "Fabricante (opcional)": "",
    "Fecha de fabricación (opcional, AAAA-MM-DD)": "",
    "Fecha de puesta en servicio (opcional, AAAA-MM-DD)": "",
    "Peso nominal en kg (opcional)": "",
    "Norma técnica (opcional)": "",
    "Observaciones (opcional)": "",
    ...overrides,
  };
  return HEADERS.map((h) => valores[h] ?? "");
}

describe("importación de matafuegos desde Excel", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.movimientoMatafuego.deleteMany({ where: { tenantId } });
        await tx.matafuego.deleteMany({ where: { tenantId } });
        await tx.establecimiento.deleteMany({ where: { tenantId } });
        await tx.contactoCliente.deleteMany({ where: { tenantId } });
        await tx.cliente.deleteMany({ where: { tenantId } });
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

  async function setupTenantCompleto() {
    const unique = randomUUID().slice(0, 8);
    const { tenant, usuarioAdmin } = await createTenant(
      {
        nombre: `Import Matafuegos Test ${unique}`,
        slug: `import-matafuegos-test-${unique}`,
        adminEmail: `admin-${unique}@example.com`,
        adminPassword: "clave-de-prueba-segura-123",
        adminNombre: "Ada",
        adminApellido: "Admin",
      },
      { usuarioId: null },
    );
    createdTenantIds.push(tenant.id);
    const adminActor: TenantActor = { tenantId: tenant.id, usuarioId: usuarioAdmin.id };

    const cliente = await createCliente(adminActor, {
      tipoCliente: "PERSONA_JURIDICA",
      razonSocial: "Cliente Import SRL",
      condicionIva: "RESPONSABLE_INSCRIPTO",
      tipoConsumidor: "EMPRESA",
    });
    const establecimiento = await createEstablecimiento(adminActor, { clienteId: cliente.id, nombre: "Planta Principal" });

    return { tenant, adminActor, cliente, establecimiento };
  }

  it("crea una unidad por cada fila válida, asociada al establecimiento del contexto", async () => {
    const { adminActor, cliente, establecimiento } = await setupTenantCompleto();
    const buffer = await buildXlsxBuffer(HEADERS, [
      filaMatafuego({ "Código interno": "MAT-0001", "N° de serie": "AR-00001" }),
      filaMatafuego({ "Código interno": "MAT-0002", "N° de serie": "AR-00002", Tipo: "Rodante", "Agente extintor": "CO2" }),
    ]);

    const resumen = await importarMatafuegos(adminActor, { clienteId: cliente.id, establecimientoId: establecimiento.id }, buffer);

    expect(resumen.creados).toBe(2);
    expect(resumen.conError).toBe(0);
    const unidades = await listMatafuegos(adminActor, { establecimientoId: establecimiento.id });
    expect(unidades).toHaveLength(2);
    expect(unidades.every((u) => u.clienteId === cliente.id)).toBe(true);
  });

  it("reporta un tipo/agente inválido como error de fila sin abortar el resto", async () => {
    const { adminActor, cliente, establecimiento } = await setupTenantCompleto();
    const buffer = await buildXlsxBuffer(HEADERS, [
      filaMatafuego({ "Código interno": "MAT-0010", "N° de serie": "AR-00010", Tipo: "No existe" }),
      filaMatafuego({ "Código interno": "MAT-0011", "N° de serie": "AR-00011" }),
    ]);

    const resumen = await importarMatafuegos(adminActor, { clienteId: cliente.id, establecimientoId: establecimiento.id }, buffer);

    expect(resumen.creados).toBe(1);
    expect(resumen.conError).toBe(1);
    const unidades = await listMatafuegos(adminActor, { establecimientoId: establecimiento.id });
    expect(unidades).toHaveLength(1);
    expect(unidades[0]?.codigoInterno).toBe("MAT-0011");
  });

  it("reporta número de serie duplicado como error de fila", async () => {
    const { adminActor, cliente, establecimiento } = await setupTenantCompleto();
    const buffer = await buildXlsxBuffer(HEADERS, [
      filaMatafuego({ "Código interno": "MAT-0020", "N° de serie": "AR-DUPLICADA" }),
      filaMatafuego({ "Código interno": "MAT-0021", "N° de serie": "AR-DUPLICADA" }),
    ]);

    const resumen = await importarMatafuegos(adminActor, { clienteId: cliente.id, establecimientoId: establecimiento.id }, buffer);

    expect(resumen.creados).toBe(1);
    expect(resumen.conError).toBe(1);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { hashPassword } from "../auth/password";
import { buildXlsxBuffer } from "../import/test-helpers";
import { importarClientes } from "./import";
import { listClientes, type TenantActor } from "./service";

const HEADERS = [
  "Tipo de cliente",
  "Nombre (persona humana)",
  "Apellido (persona humana)",
  "Razón social (persona jurídica)",
  "Nombre de fantasía (opcional)",
  "CUIT (opcional)",
  "Condición IVA",
  "Tipo de consumidor",
  "Email (opcional)",
  "WhatsApp (opcional)",
  "Teléfono alternativo (opcional)",
  "Domicilio fiscal (opcional)",
  "Provincia (opcional)",
  "Localidad (opcional)",
  "Código postal (opcional)",
  "Canal preferido (opcional)",
  "Condición de pago (opcional)",
  "Observaciones (opcional)",
];

function filaPersonaJuridica(overrides: Partial<Record<string, string>> = {}): string[] {
  const valores: Record<string, string> = {
    "Tipo de cliente": "Persona jurídica",
    "Nombre (persona humana)": "",
    "Apellido (persona humana)": "",
    "Razón social (persona jurídica)": "Distribuidora Import SRL",
    "Nombre de fantasía (opcional)": "",
    "CUIT (opcional)": "30-71234567-8",
    "Condición IVA": "Responsable inscripto",
    "Tipo de consumidor": "Empresa",
    "Email (opcional)": "",
    "WhatsApp (opcional)": "",
    "Teléfono alternativo (opcional)": "",
    "Domicilio fiscal (opcional)": "",
    "Provincia (opcional)": "",
    "Localidad (opcional)": "",
    "Código postal (opcional)": "",
    "Canal preferido (opcional)": "",
    "Condición de pago (opcional)": "",
    "Observaciones (opcional)": "",
    ...overrides,
  };
  return HEADERS.map((h) => valores[h] ?? "");
}

describe("importación de clientes desde Excel", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
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

  async function setupTenant() {
    const unique = randomUUID().slice(0, 8);
    const { tenant, usuarioAdmin } = await createTenant(
      {
        nombre: `Import Clientes Test ${unique}`,
        slug: `import-clientes-test-${unique}`,
        adminEmail: `admin-${unique}@example.com`,
        adminPassword: "clave-de-prueba-segura-123",
        adminNombre: "Ada",
        adminApellido: "Admin",
      },
      { usuarioId: null },
    );
    createdTenantIds.push(tenant.id);
    const adminActor: TenantActor = { tenantId: tenant.id, usuarioId: usuarioAdmin.id };
    return { tenant, adminActor };
  }

  async function crearActorAuditor(tenantId: string) {
    const unique = randomUUID().slice(0, 8);
    const passwordHash = await hashPassword("clave-de-prueba-segura-123");
    return withTenant({ tenantId }, async (tx) => {
      const rolAuditor = await tx.rol.findFirstOrThrow({ where: { tenantId, nombre: "Auditor" } });
      const usuario = await tx.usuario.create({
        data: {
          tenantId,
          email: `auditor-${unique}@example.com`,
          passwordHash,
          nombre: "Ana",
          apellido: "Auditora",
          roles: { create: { rolId: rolAuditor.id } },
        },
      });
      return { tenantId, usuarioId: usuario.id } satisfies TenantActor;
    });
  }

  it("crea un cliente por cada fila válida del archivo", async () => {
    const { adminActor } = await setupTenant();
    const buffer = await buildXlsxBuffer(HEADERS, [
      filaPersonaJuridica({ "CUIT (opcional)": "30-71234567-1", "Razón social (persona jurídica)": "Fila Uno SRL" }),
      filaPersonaJuridica({ "CUIT (opcional)": "30-71234567-2", "Razón social (persona jurídica)": "Fila Dos SRL" }),
    ]);

    const resumen = await importarClientes(adminActor, buffer);

    expect(resumen.creados).toBe(2);
    expect(resumen.conError).toBe(0);
    const clientes = await listClientes(adminActor);
    expect(clientes.map((c) => c.razonSocial).sort()).toEqual(["Fila Dos SRL", "Fila Uno SRL"]);
  });

  it("importa personas humanas usando nombre/apellido", async () => {
    const { adminActor } = await setupTenant();
    const buffer = await buildXlsxBuffer(HEADERS, [
      filaPersonaJuridica({
        "Tipo de cliente": "Persona humana",
        "Razón social (persona jurídica)": "",
        "Nombre (persona humana)": "Roberto",
        "Apellido (persona humana)": "Díaz",
        "CUIT (opcional)": "",
        "Condición IVA": "Monotributista",
        "Tipo de consumidor": "Consumidor final",
      }),
    ]);

    const resumen = await importarClientes(adminActor, buffer);

    expect(resumen.creados).toBe(1);
    const [cliente] = await listClientes(adminActor);
    expect(cliente?.nombre).toBe("Roberto");
    expect(cliente?.apellido).toBe("Díaz");
  });

  it("reporta como error una fila sin tipo de cliente, sin abortar el resto del archivo", async () => {
    const { adminActor } = await setupTenant();
    const buffer = await buildXlsxBuffer(HEADERS, [
      filaPersonaJuridica({ "Tipo de cliente": "", "CUIT (opcional)": "30-71234567-3" }),
      filaPersonaJuridica({ "CUIT (opcional)": "30-71234567-4", "Razón social (persona jurídica)": "Fila Válida SRL" }),
    ]);

    const resumen = await importarClientes(adminActor, buffer);

    expect(resumen.creados).toBe(1);
    expect(resumen.conError).toBe(1);
    expect(resumen.detalle.find((d) => !d.ok)?.fila).toBe(2);
    const clientes = await listClientes(adminActor);
    expect(clientes).toHaveLength(1);
    expect(clientes[0]?.razonSocial).toBe("Fila Válida SRL");
  });

  it("reporta CUIT duplicado dentro del mismo archivo como error de fila, sin afectar la primera creación", async () => {
    const { adminActor } = await setupTenant();
    const buffer = await buildXlsxBuffer(HEADERS, [
      filaPersonaJuridica({ "CUIT (opcional)": "30-71234567-5" }),
      filaPersonaJuridica({ "CUIT (opcional)": "30-71234567-5" }),
    ]);

    const resumen = await importarClientes(adminActor, buffer);

    expect(resumen.creados).toBe(1);
    expect(resumen.conError).toBe(1);
    const clientes = await listClientes(adminActor);
    expect(clientes).toHaveLength(1);
  });

  it("un rol sin permiso CREAR no puede importar (todas las filas quedan como error de permisos)", async () => {
    const { tenant, adminActor } = await setupTenant();
    const auditorActor = await crearActorAuditor(tenant.id);
    const buffer = await buildXlsxBuffer(HEADERS, [filaPersonaJuridica()]);

    const resumen = await importarClientes(auditorActor, buffer);

    expect(resumen.creados).toBe(0);
    expect(resumen.conError).toBe(1);
    const clientes = await listClientes(adminActor);
    expect(clientes).toHaveLength(0);
  });

  it("rechaza un archivo al que le falta una columna obligatoria", async () => {
    const { adminActor } = await setupTenant();
    const headersIncompletos = HEADERS.filter((h) => h !== "Condición IVA");
    const buffer = await buildXlsxBuffer(
      headersIncompletos,
      [filaPersonaJuridica()].map((fila) => fila.filter((_, i) => HEADERS[i] !== "Condición IVA")),
    );

    await expect(importarClientes(adminActor, buffer)).rejects.toThrow(/Faltan columnas/);
  });
});

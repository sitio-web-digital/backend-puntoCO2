import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "./client";
import { withTenant } from "./with-tenant";

/**
 * Prueba de integración contra el Postgres local real (docker-compose): valida
 * la garantía de seguridad central del sistema (RF-28) — que Row-Level Security
 * aísla los datos entre tenants incluso si el código de aplicación tuviera un bug.
 * Requiere que `docker compose up -d` esté corriendo.
 */
describe("aislamiento multi-tenant vía RLS", () => {
  let tenantA: { id: string };
  let tenantB: { id: string };

  beforeAll(async () => {
    tenantA = await prisma.tenant.create({ data: { nombre: "Tenant A Test", slug: `tenant-a-${randomUUID()}` } });
    tenantB = await prisma.tenant.create({ data: { nombre: "Tenant B Test", slug: `tenant-b-${randomUUID()}` } });
  });

  afterAll(async () => {
    await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
      tx.cliente.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } }),
    );
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
  });

  it("una query sin `where` sólo devuelve filas del tenant activo", async () => {
    const clienteA = await withTenant({ tenantId: tenantA.id }, (tx) =>
      tx.cliente.create({
        data: { tenantId: tenantA.id, tipoCliente: "PERSONA_JURIDICA", condicionIva: "RESPONSABLE_INSCRIPTO", tipoConsumidor: "EMPRESA", razonSocial: "Cliente A" },
      }),
    );
    await withTenant({ tenantId: tenantB.id }, (tx) =>
      tx.cliente.create({
        data: { tenantId: tenantB.id, tipoCliente: "PERSONA_JURIDICA", condicionIva: "RESPONSABLE_INSCRIPTO", tipoConsumidor: "EMPRESA", razonSocial: "Cliente B" },
      }),
    );

    const visiblesParaA = await withTenant({ tenantId: tenantA.id }, (tx) => tx.cliente.findMany());

    expect(visiblesParaA.map((c) => c.id)).toEqual([clienteA.id]);
  });

  it("un findUnique por id de otro tenant no devuelve la fila (no expone su existencia)", async () => {
    const clienteB = await withTenant({ tenantId: tenantB.id }, (tx) =>
      tx.cliente.create({
        data: { tenantId: tenantB.id, tipoCliente: "PERSONA_HUMANA", condicionIva: "CONSUMIDOR_FINAL", tipoConsumidor: "CONSUMIDOR_FINAL", nombre: "Juan", apellido: "Pérez" },
      }),
    );

    const resultado = await withTenant({ tenantId: tenantA.id }, (tx) => tx.cliente.findUnique({ where: { id: clienteB.id } }));

    expect(resultado).toBeNull();
  });

  it("rechaza insertar una fila con tenantId distinto al de la sesión activa", async () => {
    await expect(
      withTenant({ tenantId: tenantA.id }, (tx) =>
        tx.cliente.create({
          data: { tenantId: tenantB.id, tipoCliente: "PERSONA_JURIDICA", condicionIva: "RESPONSABLE_INSCRIPTO", tipoConsumidor: "EMPRESA", razonSocial: "Intento cross-tenant" },
        }),
      ),
    ).rejects.toThrow();
  });

  it("falla cerrado: una query sin ningún contexto de tenant seteado no devuelve nada, no todo", async () => {
    await withTenant({ tenantId: tenantA.id }, (tx) =>
      tx.cliente.create({
        data: { tenantId: tenantA.id, tipoCliente: "PERSONA_JURIDICA", condicionIva: "RESPONSABLE_INSCRIPTO", tipoConsumidor: "EMPRESA", razonSocial: "Otro cliente A" },
      }),
    );

    // Uso directo del cliente Prisma "crudo", como haría un repositorio con un bug
    // que se olvidó de pasar por withTenant.
    const sinContexto = await prisma.cliente.findMany({ where: { tenantId: tenantA.id } });

    expect(sinContexto).toEqual([]);
  });
});

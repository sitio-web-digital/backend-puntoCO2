import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { hashPassword } from "../auth/password";
import {
  createCliente,
  updateCliente,
  listClientes,
  getCliente,
  darDeBajaCliente,
  suspenderCliente,
  reactivarCliente,
  ClienteNotFoundError,
  CuitDuplicadoError,
  type TenantActor,
} from "./service";
import { ForbiddenError } from "../rbac/permissions";

describe("gestión de clientes (RF-01)", () => {
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
        nombre: `Clientes Test ${unique}`,
        slug: `clientes-test-${unique}`,
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

  /** Crea un usuario con el rol Auditor (sólo VER/EXPORTAR) para probar denegación. */
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

  function personaHumanaInput(overrides: Partial<Parameters<typeof createCliente>[1]> = {}) {
    return {
      tipoCliente: "PERSONA_HUMANA" as const,
      nombre: "Juan",
      apellido: "Pérez",
      condicionIva: "CONSUMIDOR_FINAL" as const,
      tipoConsumidor: "CONSUMIDOR_FINAL" as const,
      ...overrides,
    };
  }

  it("da de alta un cliente persona humana con los campos obligatorios", async () => {
    const { adminActor } = await setupTenant();
    const cliente = await createCliente(adminActor, personaHumanaInput());
    expect(cliente.nombre).toBe("Juan");
    expect(cliente.estado).toBe("ACTIVO");
  });

  it("rechaza persona jurídica sin razón social", async () => {
    const { adminActor } = await setupTenant();
    await expect(
      createCliente(adminActor, {
        tipoCliente: "PERSONA_JURIDICA",
        condicionIva: "RESPONSABLE_INSCRIPTO",
        tipoConsumidor: "EMPRESA",
      } as never),
    ).rejects.toThrow();
  });

  it("rechaza persona humana sin nombre y apellido", async () => {
    const { adminActor } = await setupTenant();
    await expect(
      createCliente(adminActor, { tipoCliente: "PERSONA_HUMANA", condicionIva: "CONSUMIDOR_FINAL", tipoConsumidor: "CONSUMIDOR_FINAL" } as never),
    ).rejects.toThrow();
  });

  it("edita un cliente existente y refleja los cambios", async () => {
    const { adminActor } = await setupTenant();
    const cliente = await createCliente(adminActor, personaHumanaInput());
    const actualizado = await updateCliente(adminActor, cliente.id, { email: "juan@example.com" });
    expect(actualizado.email).toBe("juan@example.com");
    expect(actualizado.nombre).toBe("Juan");
  });

  it("da de baja lógicamente: conserva el registro pero cambia el estado", async () => {
    const { tenant, adminActor } = await setupTenant();
    const cliente = await createCliente(adminActor, personaHumanaInput());
    const dadoDeBaja = await darDeBajaCliente(adminActor, cliente.id, "cliente cerró operaciones");

    expect(dadoDeBaja.estado).toBe("DADO_DE_BAJA");

    const sigueExistiendo = await withTenant({ tenantId: tenant.id }, (tx) => tx.cliente.findUnique({ where: { id: cliente.id } }));
    expect(sigueExistiendo).not.toBeNull();
  });

  it("un cliente dado de baja no aparece en el listado activo por defecto", async () => {
    const { adminActor } = await setupTenant();
    const cliente = await createCliente(adminActor, personaHumanaInput());
    await darDeBajaCliente(adminActor, cliente.id);

    const activos = await listClientes(adminActor, { estado: "ACTIVO" });
    expect(activos.find((c) => c.id === cliente.id)).toBeUndefined();
  });

  it("permite suspender y reactivar un cliente", async () => {
    const { adminActor } = await setupTenant();
    const cliente = await createCliente(adminActor, personaHumanaInput());

    const suspendido = await suspenderCliente(adminActor, cliente.id);
    expect(suspendido.estado).toBe("SUSPENDIDO");

    const reactivado = await reactivarCliente(adminActor, cliente.id);
    expect(reactivado.estado).toBe("ACTIVO");
  });

  it("rechaza un CUIT duplicado dentro del mismo tenant", async () => {
    const { adminActor } = await setupTenant();
    await createCliente(adminActor, personaHumanaInput({ cuit: "20-12345678-9" }));
    await expect(createCliente(adminActor, personaHumanaInput({ cuit: "20-12345678-9" }))).rejects.toThrow(CuitDuplicadoError);
  });

  it("permite el mismo CUIT en tenants distintos (la unicidad es por tenant)", async () => {
    const { adminActor: actorA } = await setupTenant();
    const { adminActor: actorB } = await setupTenant();

    await expect(createCliente(actorA, personaHumanaInput({ cuit: "20-99999999-9" }))).resolves.toBeDefined();
    await expect(createCliente(actorB, personaHumanaInput({ cuit: "20-99999999-9" }))).resolves.toBeDefined();
  });

  it("un usuario sin permiso de creación no puede dar de alta un cliente", async () => {
    const { tenant } = await setupTenant();
    const auditorActor = await crearActorAuditor(tenant.id);

    await expect(createCliente(auditorActor, personaHumanaInput())).rejects.toThrow(ForbiddenError);
  });

  it("un usuario sin permiso de edición no puede modificar un cliente aunque pueda verlo", async () => {
    const { tenant, adminActor } = await setupTenant();
    const cliente = await createCliente(adminActor, personaHumanaInput());
    const auditorActor = await crearActorAuditor(tenant.id);

    await expect(updateCliente(auditorActor, cliente.id, { email: "x@example.com" })).rejects.toThrow(ForbiddenError);
    // Pero sí puede verlo (rol Auditor tiene VER TODAS).
    await expect(getCliente(auditorActor, cliente.id)).resolves.toMatchObject({ id: cliente.id });
  });

  it("un usuario sin permiso de eliminación no puede dar de baja un cliente", async () => {
    const { tenant, adminActor } = await setupTenant();
    const cliente = await createCliente(adminActor, personaHumanaInput());
    const auditorActor = await crearActorAuditor(tenant.id);

    await expect(darDeBajaCliente(auditorActor, cliente.id)).rejects.toThrow(ForbiddenError);
  });

  it("lanza ClienteNotFoundError al operar sobre un id inexistente", async () => {
    const { adminActor } = await setupTenant();
    await expect(updateCliente(adminActor, "no-existe", { email: "x@example.com" })).rejects.toThrow(ClienteNotFoundError);
  });

  it("registra auditoría de alta, edición y baja con valores anterior/nuevo", async () => {
    const { tenant, adminActor } = await setupTenant();
    const cliente = await createCliente(adminActor, personaHumanaInput());
    await updateCliente(adminActor, cliente.id, { email: "auditado@example.com" });
    await darDeBajaCliente(adminActor, cliente.id, "prueba de auditoría");

    const logs = await withTenant({ tenantId: tenant.id }, (tx) =>
      tx.auditLog.findMany({ where: { entidad: "Cliente", entidadId: cliente.id }, orderBy: { createdAt: "asc" } }),
    );

    expect(logs.map((l) => l.accion)).toEqual(["CREATE", "UPDATE", "STATUS_CHANGE"]);
    expect(logs[2]?.motivo).toBe("prueba de auditoría");
  });

  it("un cliente de un tenant no aparece en el listado de otro tenant", async () => {
    const { adminActor: actorA } = await setupTenant();
    const { adminActor: actorB } = await setupTenant();
    await createCliente(actorA, personaHumanaInput());

    const listadoB = await listClientes(actorB);
    expect(listadoB).toHaveLength(0);
  });
});

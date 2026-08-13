import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { createCliente, type TenantActor } from "../clientes/service";
import { hashPassword } from "../auth/password";
import { ForbiddenError } from "../rbac/permissions";
import {
  createEstablecimiento,
  updateEstablecimiento,
  listEstablecimientosDeCliente,
  getEstablecimiento,
  darDeBajaEstablecimiento,
  EstablecimientoNotFoundError,
  ClienteAsociadoNotFoundError,
} from "./service";

describe("gestión de establecimientos (RF-02)", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
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

  async function setupTenantConCliente() {
    const unique = randomUUID().slice(0, 8);
    const { tenant, usuarioAdmin } = await createTenant(
      {
        nombre: `Establecimientos Test ${unique}`,
        slug: `establecimientos-test-${unique}`,
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
      razonSocial: "Cliente de prueba SRL",
      condicionIva: "RESPONSABLE_INSCRIPTO",
      tipoConsumidor: "EMPRESA",
    });

    return { tenant, adminActor, cliente };
  }

  /** Rol ad-hoc de sólo lectura (VER:TODAS sobre ESTABLECIMIENTOS, sin
   * ningún permiso de escritura) — el catálogo por defecto ya no trae un
   * rol "Auditor". */
  async function crearActorSoloLectura(tenantId: string) {
    const unique = randomUUID().slice(0, 8);
    const passwordHash = await hashPassword("clave-de-prueba-segura-123");
    return withTenant({ tenantId }, async (tx) => {
      const rol = await tx.rol.create({
        data: {
          tenantId,
          nombre: `Solo lectura ${unique}`,
          permisos: { create: { recurso: "ESTABLECIMIENTOS", accion: "VER", alcance: "TODAS" } },
        },
      });
      const usuario = await tx.usuario.create({
        data: {
          tenantId,
          email: `lectura-${unique}@example.com`,
          passwordHash,
          nombre: "Lu",
          apellido: "Lectora",
          roles: { create: { rolId: rol.id } },
        },
      });
      return { tenantId, usuarioId: usuario.id } satisfies TenantActor;
    });
  }

  it("registra un establecimiento asociado al cliente", async () => {
    const { adminActor, cliente } = await setupTenantConCliente();
    const establecimiento = await createEstablecimiento(adminActor, { clienteId: cliente.id, nombre: "Depósito Central" });

    expect(establecimiento.clienteId).toBe(cliente.id);
    expect(establecimiento.estado).toBe("ACTIVO");
  });

  it("un cliente con varias sedes las lista todas", async () => {
    const { adminActor, cliente } = await setupTenantConCliente();
    await createEstablecimiento(adminActor, { clienteId: cliente.id, nombre: "Sede Norte" });
    await createEstablecimiento(adminActor, { clienteId: cliente.id, nombre: "Sede Sur" });

    const sedes = await listEstablecimientosDeCliente(adminActor, cliente.id);
    expect(sedes).toHaveLength(2);
    expect(sedes.map((s) => s.nombre).sort()).toEqual(["Sede Norte", "Sede Sur"]);
  });

  it("rechaza crear un establecimiento para un clienteId inexistente", async () => {
    const { adminActor } = await setupTenantConCliente();
    await expect(createEstablecimiento(adminActor, { clienteId: "no-existe", nombre: "Sede Fantasma" })).rejects.toThrow(
      ClienteAsociadoNotFoundError,
    );
  });

  it("rechaza crear un establecimiento para un cliente de OTRO tenant (el FK no alcanza bajo RLS)", async () => {
    const { adminActor: actorA } = await setupTenantConCliente();
    const { cliente: clienteB } = await setupTenantConCliente();

    await expect(createEstablecimiento(actorA, { clienteId: clienteB.id, nombre: "Intento cross-tenant" })).rejects.toThrow(
      ClienteAsociadoNotFoundError,
    );
  });

  it("edita un establecimiento existente", async () => {
    const { adminActor, cliente } = await setupTenantConCliente();
    const establecimiento = await createEstablecimiento(adminActor, { clienteId: cliente.id, nombre: "Sede Original" });

    const actualizado = await updateEstablecimiento(adminActor, establecimiento.id, { nombre: "Sede Renombrada", provincia: "Buenos Aires" });
    expect(actualizado.nombre).toBe("Sede Renombrada");
    expect(actualizado.provincia).toBe("Buenos Aires");
  });

  it("da de baja lógicamente un establecimiento y conserva el registro", async () => {
    const { tenant, adminActor, cliente } = await setupTenantConCliente();
    const establecimiento = await createEstablecimiento(adminActor, { clienteId: cliente.id, nombre: "Sede a dar de baja" });

    const dadoDeBaja = await darDeBajaEstablecimiento(adminActor, establecimiento.id);
    expect(dadoDeBaja.estado).toBe("DADO_DE_BAJA");

    const sigueExistiendo = await withTenant({ tenantId: tenant.id }, (tx) => tx.establecimiento.findUnique({ where: { id: establecimiento.id } }));
    expect(sigueExistiendo).not.toBeNull();
  });

  it("un establecimiento dado de baja no aparece en el listado activo por defecto", async () => {
    const { adminActor, cliente } = await setupTenantConCliente();
    const establecimiento = await createEstablecimiento(adminActor, { clienteId: cliente.id, nombre: "Sede a filtrar" });
    await darDeBajaEstablecimiento(adminActor, establecimiento.id);

    const activos = await listEstablecimientosDeCliente(adminActor, cliente.id, { estado: "ACTIVO" });
    expect(activos.find((e) => e.id === establecimiento.id)).toBeUndefined();
  });

  it("un usuario sin permiso de creación no puede registrar un establecimiento", async () => {
    const { tenant, cliente } = await setupTenantConCliente();
    const soloLecturaActor = await crearActorSoloLectura(tenant.id);

    await expect(createEstablecimiento(soloLecturaActor, { clienteId: cliente.id, nombre: "Sede no autorizada" })).rejects.toThrow(ForbiddenError);
  });

  it("lanza EstablecimientoNotFoundError al operar sobre un id inexistente", async () => {
    const { adminActor } = await setupTenantConCliente();
    await expect(updateEstablecimiento(adminActor, "no-existe", { nombre: "x" })).rejects.toThrow(EstablecimientoNotFoundError);
  });

  it("registra auditoría de alta y baja con motivo", async () => {
    const { tenant, adminActor, cliente } = await setupTenantConCliente();
    const establecimiento = await createEstablecimiento(adminActor, { clienteId: cliente.id, nombre: "Sede auditada" });
    await darDeBajaEstablecimiento(adminActor, establecimiento.id, "cierre de sede");

    const logs = await withTenant({ tenantId: tenant.id }, (tx) =>
      tx.auditLog.findMany({ where: { entidad: "Establecimiento", entidadId: establecimiento.id }, orderBy: { createdAt: "asc" } }),
    );
    expect(logs.map((l) => l.accion)).toEqual(["CREATE", "STATUS_CHANGE"]);
    expect(logs[1]?.motivo).toBe("cierre de sede");
  });

  it("un establecimiento de un tenant no es accesible desde otro (RLS)", async () => {
    const { adminActor: actorA, cliente } = await setupTenantConCliente();
    const { adminActor: actorB } = await setupTenantConCliente();
    const establecimiento = await createEstablecimiento(actorA, { clienteId: cliente.id, nombre: "Sede privada de A" });

    await expect(getEstablecimiento(actorB, establecimiento.id)).rejects.toThrow(EstablecimientoNotFoundError);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { createCliente, type TenantActor } from "../clientes/service";
import { createEstablecimiento } from "../establecimientos/service";
import { hashPassword } from "../auth/password";
import { ForbiddenError } from "../rbac/permissions";
import {
  createSector,
  updateSector,
  listSectoresDeEstablecimiento,
  getSector,
  darDeBajaSector,
  SectorNotFoundError,
  EstablecimientoAsociadoNotFoundError,
  SectorPadreInvalidoError,
  createUbicacion,
  updateUbicacion,
  listUbicacionesDeSector,
  darDeBajaUbicacion,
  UbicacionNotFoundError,
  SectorAsociadoNotFoundError,
} from "./service";

describe("gestión de sectores y ubicaciones (RF-03)", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.ubicacion.deleteMany({ where: { tenantId } });
        await tx.sector.deleteMany({ where: { tenantId } });
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

  async function setupTenantConEstablecimiento() {
    const unique = randomUUID().slice(0, 8);
    const { tenant, usuarioAdmin } = await createTenant(
      {
        nombre: `Sectores Test ${unique}`,
        slug: `sectores-test-${unique}`,
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
    const establecimiento = await createEstablecimiento(adminActor, { clienteId: cliente.id, nombre: "Planta Principal" });

    return { tenant, adminActor, cliente, establecimiento };
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

  describe("sectores", () => {
    it("crea un sector de nivel superior (piso/área) asociado al establecimiento", async () => {
      const { adminActor, establecimiento } = await setupTenantConEstablecimiento();
      const sector = await createSector(adminActor, { establecimientoId: establecimiento.id, nombre: "Planta Baja" });

      expect(sector.establecimientoId).toBe(establecimiento.id);
      expect(sector.parentSectorId).toBeNull();
    });

    it("crea un sub-sector con un sector padre válido del mismo establecimiento", async () => {
      const { adminActor, establecimiento } = await setupTenantConEstablecimiento();
      const piso = await createSector(adminActor, { establecimientoId: establecimiento.id, nombre: "Planta Baja" });
      const subsector = await createSector(adminActor, {
        establecimientoId: establecimiento.id,
        parentSectorId: piso.id,
        nombre: "Depósito",
      });

      expect(subsector.parentSectorId).toBe(piso.id);
    });

    it("rechaza un sector padre que pertenece a OTRO establecimiento", async () => {
      const { adminActor, establecimiento: estA } = await setupTenantConEstablecimiento();
      const clienteB = await createCliente(adminActor, {
        tipoCliente: "PERSONA_JURIDICA",
        razonSocial: "Otro cliente",
        condicionIva: "RESPONSABLE_INSCRIPTO",
        tipoConsumidor: "EMPRESA",
      });
      const estB = await createEstablecimiento(adminActor, { clienteId: clienteB.id, nombre: "Otra planta" });
      const sectorEnB = await createSector(adminActor, { establecimientoId: estB.id, nombre: "Sector en B" });

      await expect(
        createSector(adminActor, { establecimientoId: estA.id, parentSectorId: sectorEnB.id, nombre: "Intento cruzado" }),
      ).rejects.toThrow(SectorPadreInvalidoError);
    });

    it("rechaza crear un sector para un establecimiento inexistente", async () => {
      const { adminActor } = await setupTenantConEstablecimiento();
      await expect(createSector(adminActor, { establecimientoId: "no-existe", nombre: "x" })).rejects.toThrow(EstablecimientoAsociadoNotFoundError);
    });

    it("lista los sectores de un establecimiento", async () => {
      const { adminActor, establecimiento } = await setupTenantConEstablecimiento();
      await createSector(adminActor, { establecimientoId: establecimiento.id, nombre: "Sector A" });
      await createSector(adminActor, { establecimientoId: establecimiento.id, nombre: "Sector B" });

      const sectores = await listSectoresDeEstablecimiento(adminActor, establecimiento.id);
      expect(sectores).toHaveLength(2);
    });

    it("edita un sector existente", async () => {
      const { adminActor, establecimiento } = await setupTenantConEstablecimiento();
      const sector = await createSector(adminActor, { establecimientoId: establecimiento.id, nombre: "Original" });
      const actualizado = await updateSector(adminActor, sector.id, { nombre: "Renombrado", responsable: "Juan Pérez" });

      expect(actualizado.nombre).toBe("Renombrado");
      expect(actualizado.responsable).toBe("Juan Pérez");
    });

    it("da de baja lógicamente un sector, quedando disponible para consultar", async () => {
      const { tenant, adminActor, establecimiento } = await setupTenantConEstablecimiento();
      const sector = await createSector(adminActor, { establecimientoId: establecimiento.id, nombre: "A dar de baja" });
      const dadoDeBaja = await darDeBajaSector(adminActor, sector.id);

      expect(dadoDeBaja.estado).toBe("DADO_DE_BAJA");
      const sigueExistiendo = await withTenant({ tenantId: tenant.id }, (tx) => tx.sector.findUnique({ where: { id: sector.id } }));
      expect(sigueExistiendo).not.toBeNull();
    });

    it("un usuario sin permiso de creación no puede crear un sector", async () => {
      const { tenant, establecimiento } = await setupTenantConEstablecimiento();
      const auditorActor = await crearActorAuditor(tenant.id);
      await expect(createSector(auditorActor, { establecimientoId: establecimiento.id, nombre: "No autorizado" })).rejects.toThrow(ForbiddenError);
    });

    it("lanza SectorNotFoundError al operar sobre un id inexistente", async () => {
      const { adminActor } = await setupTenantConEstablecimiento();
      await expect(updateSector(adminActor, "no-existe", { nombre: "x" })).rejects.toThrow(SectorNotFoundError);
    });

    it("un sector queda disponible para asociar sub-sectores y ubicaciones apenas se crea", async () => {
      const { adminActor, establecimiento } = await setupTenantConEstablecimiento();
      const sector = await createSector(adminActor, { establecimientoId: establecimiento.id, nombre: "Disponible" });

      await expect(createSector(adminActor, { establecimientoId: establecimiento.id, parentSectorId: sector.id, nombre: "Hijo" })).resolves.toBeDefined();
      await expect(createUbicacion(adminActor, { sectorId: sector.id, nombre: "Pasillo 1" })).resolves.toBeDefined();
    });
  });

  describe("ubicaciones", () => {
    async function crearSector(actor: TenantActor, establecimientoId: string) {
      return createSector(actor, { establecimientoId, nombre: "Sector para ubicaciones" });
    }

    it("registra una ubicación asociada a un sector", async () => {
      const { adminActor, establecimiento } = await setupTenantConEstablecimiento();
      const sector = await crearSector(adminActor, establecimiento.id);
      const ubicacion = await createUbicacion(adminActor, { sectorId: sector.id, nombre: "Pasillo principal" });

      expect(ubicacion.sectorId).toBe(sector.id);
    });

    it("rechaza crear una ubicación para un sector inexistente", async () => {
      const { adminActor } = await setupTenantConEstablecimiento();
      await expect(createUbicacion(adminActor, { sectorId: "no-existe", nombre: "x" })).rejects.toThrow(SectorAsociadoNotFoundError);
    });

    it("rechaza crear una ubicación para un sector de OTRO tenant", async () => {
      const { adminActor: actorA } = await setupTenantConEstablecimiento();
      const { adminActor: actorB, establecimiento: estB } = await setupTenantConEstablecimiento();
      const sectorB = await crearSector(actorB, estB.id);

      await expect(createUbicacion(actorA, { sectorId: sectorB.id, nombre: "Cross-tenant" })).rejects.toThrow(SectorAsociadoNotFoundError);
    });

    it("lista las ubicaciones de un sector", async () => {
      const { adminActor, establecimiento } = await setupTenantConEstablecimiento();
      const sector = await crearSector(adminActor, establecimiento.id);
      await createUbicacion(adminActor, { sectorId: sector.id, nombre: "Ubicación 1" });
      await createUbicacion(adminActor, { sectorId: sector.id, nombre: "Ubicación 2" });

      const ubicaciones = await listUbicacionesDeSector(adminActor, sector.id);
      expect(ubicaciones).toHaveLength(2);
    });

    it("edita una ubicación existente", async () => {
      const { adminActor, establecimiento } = await setupTenantConEstablecimiento();
      const sector = await crearSector(adminActor, establecimiento.id);
      const ubicacion = await createUbicacion(adminActor, { sectorId: sector.id, nombre: "Original" });

      const actualizada = await updateUbicacion(adminActor, ubicacion.id, { nombre: "Renombrada" });
      expect(actualizada.nombre).toBe("Renombrada");
    });

    it("da de baja lógicamente una ubicación", async () => {
      const { adminActor, establecimiento } = await setupTenantConEstablecimiento();
      const sector = await crearSector(adminActor, establecimiento.id);
      const ubicacion = await createUbicacion(adminActor, { sectorId: sector.id, nombre: "A dar de baja" });

      const dadaDeBaja = await darDeBajaUbicacion(adminActor, ubicacion.id);
      expect(dadaDeBaja.estado).toBe("DADO_DE_BAJA");
    });

    it("lanza UbicacionNotFoundError al operar sobre un id inexistente", async () => {
      const { adminActor } = await setupTenantConEstablecimiento();
      await expect(updateUbicacion(adminActor, "no-existe", { nombre: "x" })).rejects.toThrow(UbicacionNotFoundError);
    });
  });

  it("consulta un sector con sus sub-sectores y ubicaciones incluidas", async () => {
    const { adminActor, establecimiento } = await setupTenantConEstablecimiento();
    const piso = await createSector(adminActor, { establecimientoId: establecimiento.id, nombre: "Piso 1" });
    await createSector(adminActor, { establecimientoId: establecimiento.id, parentSectorId: piso.id, nombre: "Subsector" });
    await createUbicacion(adminActor, { sectorId: piso.id, nombre: "Ubicación directa" });

    const conDetalle = await getSector(adminActor, piso.id);
    expect(conDetalle?.subSectores).toHaveLength(1);
    expect(conDetalle?.ubicaciones).toHaveLength(1);
  });
});

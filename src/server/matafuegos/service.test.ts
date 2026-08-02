import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { createCliente, type TenantActor } from "../clientes/service";
import { createEstablecimiento } from "../establecimientos/service";
import { createSector, createUbicacion } from "../sectores/service";
import { hashPassword } from "../auth/password";
import { ForbiddenError } from "../rbac/permissions";
import {
  createMatafuego,
  updateMatafuego,
  listMatafuegos,
  getMatafuego,
  darDeBajaMatafuego,
  moverMatafuego,
  listMovimientosDeMatafuego,
  MatafuegoNotFoundError,
  NumeroSerieDuplicadoError,
  CodigoInternoDuplicadoError,
  ClienteAsociadoNotFoundError,
  SectorInvalidoError,
  UbicacionInvalidaError,
} from "./service";

describe("inventario técnico de matafuegos (RF-04)", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.movimientoMatafuego.deleteMany({ where: { tenantId } });
        await tx.matafuego.deleteMany({ where: { tenantId } });
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

  async function setupTenantCompleto() {
    const unique = randomUUID().slice(0, 8);
    const { tenant, usuarioAdmin } = await createTenant(
      {
        nombre: `Matafuegos Test ${unique}`,
        slug: `matafuegos-test-${unique}`,
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
    const sector = await createSector(adminActor, { establecimientoId: establecimiento.id, nombre: "Sector A" });
    const ubicacion = await createUbicacion(adminActor, { sectorId: sector.id, nombre: "Pasillo 1" });

    return { tenant, adminActor, cliente, establecimiento, sector, ubicacion };
  }

  async function crearActorConRol(tenantId: string, nombreRol: string) {
    const unique = randomUUID().slice(0, 8);
    const passwordHash = await hashPassword("clave-de-prueba-segura-123");
    return withTenant({ tenantId }, async (tx) => {
      const rol = await tx.rol.findFirstOrThrow({ where: { tenantId, nombre: nombreRol } });
      const usuario = await tx.usuario.create({
        data: {
          tenantId,
          email: `${nombreRol.toLowerCase().replace(/\s+/g, "-")}-${unique}@example.com`,
          passwordHash,
          nombre: "Usuario",
          apellido: nombreRol,
          roles: { create: { rolId: rol.id } },
        },
      });
      return { tenantId, usuarioId: usuario.id } satisfies TenantActor;
    });
  }

  function inputBase(overrides: { clienteId: string; establecimientoId: string } & Partial<Parameters<typeof createMatafuego>[1]>) {
    const unique = randomUUID().slice(0, 8);
    return {
      codigoInterno: `MAT-${unique}`,
      numeroSerie: `SN-${unique}`,
      tipo: "PORTATIL" as const,
      agenteExtintor: "POLVO_QUIMICO_ABC" as const,
      ...overrides,
    };
  }

  it("registra una unidad con número de serie y datos obligatorios, y aparece en el inventario", async () => {
    const { adminActor, cliente, establecimiento } = await setupTenantCompleto();
    const matafuego = await createMatafuego(adminActor, inputBase({ clienteId: cliente.id, establecimientoId: establecimiento.id }));

    expect(matafuego.estado).toBe("PENDIENTE_DE_CONTROL");

    const listado = await listMatafuegos(adminActor);
    expect(listado.map((m) => m.id)).toContain(matafuego.id);
  });

  it("impide registrar dos unidades con el mismo número de serie en el mismo tenant", async () => {
    const { adminActor, cliente, establecimiento } = await setupTenantCompleto();
    const input = inputBase({ clienteId: cliente.id, establecimientoId: establecimiento.id });
    await createMatafuego(adminActor, input);

    await expect(
      createMatafuego(adminActor, { ...input, codigoInterno: `otro-${randomUUID().slice(0, 8)}` }),
    ).rejects.toThrow(NumeroSerieDuplicadoError);
  });

  it("impide registrar dos unidades con el mismo código interno en el mismo tenant", async () => {
    const { adminActor, cliente, establecimiento } = await setupTenantCompleto();
    const input = inputBase({ clienteId: cliente.id, establecimientoId: establecimiento.id });
    await createMatafuego(adminActor, input);

    await expect(
      createMatafuego(adminActor, { ...input, numeroSerie: `otro-${randomUUID().slice(0, 8)}` }),
    ).rejects.toThrow(CodigoInternoDuplicadoError);
  });

  it("rechaza asociar la unidad a un cliente inexistente", async () => {
    const { adminActor, establecimiento } = await setupTenantCompleto();
    await expect(createMatafuego(adminActor, inputBase({ clienteId: "no-existe", establecimientoId: establecimiento.id }))).rejects.toThrow(
      ClienteAsociadoNotFoundError,
    );
  });

  it("rechaza un sector que no pertenece al establecimiento indicado", async () => {
    const { adminActor, cliente, establecimiento } = await setupTenantCompleto();
    const clienteB = await createCliente(adminActor, {
      tipoCliente: "PERSONA_JURIDICA",
      razonSocial: "Otro cliente",
      condicionIva: "RESPONSABLE_INSCRIPTO",
      tipoConsumidor: "EMPRESA",
    });
    const establecimientoB = await createEstablecimiento(adminActor, { clienteId: clienteB.id, nombre: "Otra planta" });
    const sectorB = await createSector(adminActor, { establecimientoId: establecimientoB.id, nombre: "Sector B" });

    await expect(
      createMatafuego(adminActor, inputBase({ clienteId: cliente.id, establecimientoId: establecimiento.id, sectorId: sectorB.id })),
    ).rejects.toThrow(SectorInvalidoError);
  });

  it("rechaza una ubicación que no pertenece al sector indicado", async () => {
    const { adminActor, cliente, establecimiento, sector } = await setupTenantCompleto();
    const otroSector = await createSector(adminActor, { establecimientoId: establecimiento.id, nombre: "Otro sector" });
    const ubicacionDeOtroSector = await createUbicacion(adminActor, { sectorId: otroSector.id, nombre: "Ubicación ajena" });

    await expect(
      createMatafuego(
        adminActor,
        inputBase({ clienteId: cliente.id, establecimientoId: establecimiento.id, sectorId: sector.id, ubicacionId: ubicacionDeOtroSector.id }),
      ),
    ).rejects.toThrow(UbicacionInvalidaError);
  });

  it("da de baja lógicamente una unidad, conservando su trazabilidad", async () => {
    const { tenant, adminActor, cliente, establecimiento } = await setupTenantCompleto();
    const matafuego = await createMatafuego(adminActor, inputBase({ clienteId: cliente.id, establecimientoId: establecimiento.id }));

    const dadoDeBaja = await darDeBajaMatafuego(adminActor, matafuego.id, "unidad irrecuperable");
    expect(dadoDeBaja.estado).toBe("DADO_DE_BAJA");

    const sigueExistiendo = await withTenant({ tenantId: tenant.id }, (tx) => tx.matafuego.findUnique({ where: { id: matafuego.id } }));
    expect(sigueExistiendo).not.toBeNull();

    const logs = await withTenant({ tenantId: tenant.id }, (tx) =>
      tx.auditLog.findMany({ where: { entidad: "Matafuego", entidadId: matafuego.id, accion: "STATUS_CHANGE" } }),
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]?.motivo).toBe("unidad irrecuperable");
  });

  it("un usuario sin permisos técnicos (alcance no-TODAS) no puede modificar un dato administrativo restringido", async () => {
    const { tenant, adminActor, cliente, establecimiento } = await setupTenantCompleto();
    const matafuego = await createMatafuego(adminActor, inputBase({ clienteId: cliente.id, establecimientoId: establecimiento.id }));
    const tecnicoActor = await crearActorConRol(tenant.id, "Técnico de campo");

    await expect(updateMatafuego(tecnicoActor, matafuego.id, { fabricante: "Otro fabricante" })).rejects.toThrow(ForbiddenError);
  });

  it("un técnico de campo SÍ puede registrar los campos de relevamiento físico (operativos)", async () => {
    const { tenant, adminActor, cliente, establecimiento } = await setupTenantCompleto();
    const matafuego = await createMatafuego(adminActor, inputBase({ clienteId: cliente.id, establecimientoId: establecimiento.id }));
    const tecnicoActor = await crearActorConRol(tenant.id, "Técnico de campo");

    const actualizado = await updateMatafuego(tecnicoActor, matafuego.id, {
      pesoVerificado: 4.8,
      estadoManometro: "EN_RANGO",
      observaciones: "Relevado en campo",
    });

    expect(actualizado.pesoVerificado).toBe(4.8);
    expect(actualizado.estadoManometro).toBe("EN_RANGO");
  });

  it("un auditor (sólo VER) no puede editar ni siquiera campos operativos", async () => {
    const { tenant, adminActor, cliente, establecimiento } = await setupTenantCompleto();
    const matafuego = await createMatafuego(adminActor, inputBase({ clienteId: cliente.id, establecimientoId: establecimiento.id }));
    const auditorActor = await crearActorConRol(tenant.id, "Auditor");

    await expect(updateMatafuego(auditorActor, matafuego.id, { observaciones: "no debería poder" })).rejects.toThrow(ForbiddenError);
  });

  it("mueve una unidad a otro sector/ubicación y registra el movimiento con origen, destino y usuario", async () => {
    const { adminActor, cliente, establecimiento, sector, ubicacion } = await setupTenantCompleto();
    const matafuego = await createMatafuego(
      adminActor,
      inputBase({ clienteId: cliente.id, establecimientoId: establecimiento.id, sectorId: sector.id, ubicacionId: ubicacion.id }),
    );

    const nuevoSector = await createSector(adminActor, { establecimientoId: establecimiento.id, nombre: "Sector destino" });
    const nuevaUbicacion = await createUbicacion(adminActor, { sectorId: nuevoSector.id, nombre: "Ubicación destino" });

    const movido = await moverMatafuego(adminActor, matafuego.id, {
      sectorDestinoId: nuevoSector.id,
      ubicacionDestinoId: nuevaUbicacion.id,
      motivo: "reorganización de planta",
    });

    expect(movido.sectorId).toBe(nuevoSector.id);
    expect(movido.ubicacionId).toBe(nuevaUbicacion.id);

    const movimientos = await listMovimientosDeMatafuego(adminActor, matafuego.id);
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0]).toMatchObject({
      sectorOrigenId: sector.id,
      ubicacionOrigenId: ubicacion.id,
      sectorDestinoId: nuevoSector.id,
      ubicacionDestinoId: nuevaUbicacion.id,
      usuarioId: adminActor.usuarioId,
      motivo: "reorganización de planta",
    });
  });

  it("un técnico no puede mover una unidad (requiere alcance TODAS)", async () => {
    const { tenant, adminActor, cliente, establecimiento } = await setupTenantCompleto();
    const matafuego = await createMatafuego(adminActor, inputBase({ clienteId: cliente.id, establecimientoId: establecimiento.id }));
    const tecnicoActor = await crearActorConRol(tenant.id, "Técnico de campo");
    const otroSector = await createSector(adminActor, { establecimientoId: establecimiento.id, nombre: "x" });

    await expect(moverMatafuego(tecnicoActor, matafuego.id, { sectorDestinoId: otroSector.id })).rejects.toThrow(ForbiddenError);
  });

  it("lanza MatafuegoNotFoundError al operar sobre un id inexistente", async () => {
    const { adminActor } = await setupTenantCompleto();
    await expect(updateMatafuego(adminActor, "no-existe", { observaciones: "x" })).rejects.toThrow(MatafuegoNotFoundError);
  });

  it("una unidad de un tenant no es accesible desde otro (RLS)", async () => {
    const { adminActor: actorA, cliente, establecimiento } = await setupTenantCompleto();
    const { adminActor: actorB } = await setupTenantCompleto();
    const matafuego = await createMatafuego(actorA, inputBase({ clienteId: cliente.id, establecimientoId: establecimiento.id }));

    await expect(getMatafuego(actorB, matafuego.id)).rejects.toThrow(MatafuegoNotFoundError);
  });

  it("filtra el listado por estado, cliente y establecimiento", async () => {
    const { adminActor, cliente, establecimiento } = await setupTenantCompleto();
    const m1 = await createMatafuego(adminActor, inputBase({ clienteId: cliente.id, establecimientoId: establecimiento.id }));
    await darDeBajaMatafuego(adminActor, m1.id);
    const m2 = await createMatafuego(adminActor, inputBase({ clienteId: cliente.id, establecimientoId: establecimiento.id }));

    const activos = await listMatafuegos(adminActor, { estado: "PENDIENTE_DE_CONTROL" });
    expect(activos.map((m) => m.id)).toEqual([m2.id]);
  });
});

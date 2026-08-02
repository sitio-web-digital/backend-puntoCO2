import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { createCliente, type TenantActor } from "../clientes/service";
import { createEstablecimiento } from "../establecimientos/service";
import { createSector, createUbicacion } from "../sectores/service";
import { createMatafuego } from "../matafuegos/service";
import { hashPassword } from "../auth/password";
import { ForbiddenError } from "../rbac/permissions";
import {
  crearInspeccion,
  listInspecciones,
  getInspeccion,
  esResultadoNoConforme,
  MatafuegoAsociadoNotFoundError,
  UbicacionDetectadaInvalidaError,
} from "./service";

describe("inspecciones con checklist (RF-06)", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.inspeccion.deleteMany({ where: { tenantId } });
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

  async function setupMatafuego(conUbicacion = false) {
    const unique = randomUUID().slice(0, 8);
    const { tenant, usuarioAdmin } = await createTenant(
      {
        nombre: `Inspecciones Test ${unique}`,
        slug: `inspecciones-test-${unique}`,
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
      razonSocial: "Cliente Inspecciones SRL",
      condicionIva: "RESPONSABLE_INSCRIPTO",
      tipoConsumidor: "EMPRESA",
    });
    const establecimiento = await createEstablecimiento(adminActor, { clienteId: cliente.id, nombre: "Planta" });

    let sectorId: string | undefined;
    let ubicacionId: string | undefined;
    if (conUbicacion) {
      const sector = await createSector(adminActor, { establecimientoId: establecimiento.id, nombre: "Sector A" });
      const ubicacion = await createUbicacion(adminActor, { sectorId: sector.id, nombre: "Pasillo 1" });
      sectorId = sector.id;
      ubicacionId = ubicacion.id;
    }

    const matafuego = await createMatafuego(adminActor, {
      codigoInterno: `MAT-${unique}`,
      numeroSerie: `SN-${unique}`,
      clienteId: cliente.id,
      establecimientoId: establecimiento.id,
      ...(sectorId ? { sectorId } : {}),
      ...(ubicacionId ? { ubicacionId } : {}),
      tipo: "PORTATIL",
      agenteExtintor: "CO2",
    });

    return { tenant, adminActor, cliente, establecimiento, matafuego };
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

  it("un técnico registra una inspección y queda asociada a la unidad, a su propio nombre", async () => {
    const { tenant, matafuego } = await setupMatafuego();
    const tecnicoActor = await crearActorConRol(tenant.id, "Técnico de campo");

    const inspeccion = await crearInspeccion(tecnicoActor, {
      matafuegoId: matafuego.id,
      resultado: "APTO",
      equipoPresente: true,
      accesoLibre: true,
    });

    expect(inspeccion.matafuegoId).toBe(matafuego.id);
    expect(inspeccion.tecnicoId).toBe(tecnicoActor.usuarioId);
    expect(inspeccion.establecimientoId).toBe(matafuego.establecimientoId);
  });

  it("rechaza una inspección sin resultado (dato mínimo obligatorio)", async () => {
    const { adminActor, matafuego } = await setupMatafuego();
    await expect(crearInspeccion(adminActor, { matafuegoId: matafuego.id } as never)).rejects.toThrow();
  });

  it("rechaza una inspección para un matafuego inexistente", async () => {
    const { adminActor } = await setupMatafuego();
    await expect(crearInspeccion(adminActor, { matafuegoId: "no-existe", resultado: "APTO" })).rejects.toThrow(MatafuegoAsociadoNotFoundError);
  });

  it("rechaza una ubicación detectada que no existe", async () => {
    const { adminActor, matafuego } = await setupMatafuego();
    await expect(
      crearInspeccion(adminActor, { matafuegoId: matafuego.id, resultado: "APTO", ubicacionDetectadaId: "no-existe" }),
    ).rejects.toThrow(UbicacionDetectadaInvalidaError);
  });

  it("deriva ubicacionRegistrada de la ubicación actual del matafuego, no del input", async () => {
    const { adminActor, matafuego } = await setupMatafuego(true);
    const inspeccion = await crearInspeccion(adminActor, { matafuegoId: matafuego.id, resultado: "APTO" });
    expect(inspeccion.ubicacionRegistradaId).toBe(matafuego.ubicacionId);
  });

  it("actualiza fechaUltimaInspeccion del matafuego al crear la inspección", async () => {
    const { tenant, adminActor, matafuego } = await setupMatafuego();
    const inspeccion = await crearInspeccion(adminActor, { matafuegoId: matafuego.id, resultado: "APTO" });

    const actualizado = await withTenant({ tenantId: tenant.id }, (tx) => tx.matafuego.findUnique({ where: { id: matafuego.id } }));
    expect(actualizado?.fechaUltimaInspeccion?.getTime()).toBe(inspeccion.fechaHora.getTime());
  });

  it.each([
    ["APTO", "APTO"],
    ["APTO_CON_OBSERVACIONES", "OBSERVADO"],
    ["REQUIERE_MANTENIMIENTO", "OBSERVADO"],
    ["REQUIERE_RECARGA", "OBSERVADO"],
    ["REQUIERE_REEMPLAZO", "OBSERVADO"],
    ["NO_ENCONTRADO", "EXTRAVIADO"],
  ] as const)("resultado %s deriva el matafuego a estado %s", async (resultado, estadoEsperado) => {
    const { tenant, adminActor, matafuego } = await setupMatafuego();
    await crearInspeccion(adminActor, { matafuegoId: matafuego.id, resultado });

    const actualizado = await withTenant({ tenantId: tenant.id }, (tx) => tx.matafuego.findUnique({ where: { id: matafuego.id } }));
    expect(actualizado?.estado).toBe(estadoEsperado);
  });

  it("ACCESO_IMPOSIBLE no cambia el estado del matafuego (no se pudo verificar nada)", async () => {
    const { tenant, adminActor, matafuego } = await setupMatafuego();
    await crearInspeccion(adminActor, { matafuegoId: matafuego.id, resultado: "ACCESO_IMPOSIBLE" });

    const actualizado = await withTenant({ tenantId: tenant.id }, (tx) => tx.matafuego.findUnique({ where: { id: matafuego.id } }));
    expect(actualizado?.estado).toBe(matafuego.estado);
  });

  it("marca requiereAccionSeguimiento según el resultado", () => {
    expect(esResultadoNoConforme("APTO")).toBe(false);
    expect(esResultadoNoConforme("APTO_CON_OBSERVACIONES")).toBe(true);
    expect(esResultadoNoConforme("REQUIERE_MANTENIMIENTO")).toBe(true);
    expect(esResultadoNoConforme("NO_ENCONTRADO")).toBe(true);
    expect(esResultadoNoConforme("ACCESO_IMPOSIBLE")).toBe(true);
  });

  it("lista el historial de un matafuego ordenado por fecha descendente", async () => {
    const { adminActor, matafuego } = await setupMatafuego();
    const primera = await crearInspeccion(adminActor, { matafuegoId: matafuego.id, resultado: "APTO" });
    const segunda = await crearInspeccion(adminActor, { matafuegoId: matafuego.id, resultado: "APTO_CON_OBSERVACIONES" });

    const historial = await listInspecciones(adminActor, { matafuegoId: matafuego.id });
    expect(historial.map((i) => i.id)).toEqual([segunda.id, primera.id]);
  });

  it("un técnico (alcance PROPIO) sólo ve sus propias inspecciones en el listado", async () => {
    const { tenant, adminActor, matafuego } = await setupMatafuego();
    const tecnicoA = await crearActorConRol(tenant.id, "Técnico de campo");
    const tecnicoB = await crearActorConRol(tenant.id, "Técnico de campo");

    const inspeccionDeA = await crearInspeccion(tecnicoA, { matafuegoId: matafuego.id, resultado: "APTO" });
    await crearInspeccion(tecnicoB, { matafuegoId: matafuego.id, resultado: "APTO" });

    const listadoDeA = await listInspecciones(tecnicoA);
    expect(listadoDeA.map((i) => i.id)).toEqual([inspeccionDeA.id]);

    // El admin (alcance TODAS) ve ambas.
    const listadoAdmin = await listInspecciones(adminActor, { matafuegoId: matafuego.id });
    expect(listadoAdmin).toHaveLength(2);
  });

  it("un técnico no puede ver la inspección de otro técnico por id", async () => {
    const { tenant, matafuego } = await setupMatafuego();
    const tecnicoA = await crearActorConRol(tenant.id, "Técnico de campo");
    const tecnicoB = await crearActorConRol(tenant.id, "Técnico de campo");

    const inspeccion = await crearInspeccion(tecnicoA, { matafuegoId: matafuego.id, resultado: "APTO" });

    await expect(getInspeccion(tecnicoB, inspeccion.id)).resolves.toBeNull();
    await expect(getInspeccion(tecnicoA, inspeccion.id)).resolves.toMatchObject({ id: inspeccion.id });
  });

  it("un auditor (sólo VER) no puede crear inspecciones", async () => {
    const { tenant, matafuego } = await setupMatafuego();
    const auditorActor = await crearActorConRol(tenant.id, "Auditor");

    await expect(crearInspeccion(auditorActor, { matafuegoId: matafuego.id, resultado: "APTO" })).rejects.toThrow(ForbiddenError);
  });

  it("registra auditoría de alta de inspección y del cambio de estado del matafuego", async () => {
    const { tenant, adminActor, matafuego } = await setupMatafuego();
    const inspeccion = await crearInspeccion(adminActor, { matafuegoId: matafuego.id, resultado: "REQUIERE_MANTENIMIENTO" });

    const logsInspeccion = await withTenant({ tenantId: tenant.id }, (tx) =>
      tx.auditLog.findMany({ where: { entidad: "Inspeccion", entidadId: inspeccion.id } }),
    );
    expect(logsInspeccion).toHaveLength(1);
    expect(logsInspeccion[0]?.accion).toBe("CREATE");

    const logsMatafuego = await withTenant({ tenantId: tenant.id }, (tx) =>
      tx.auditLog.findMany({ where: { entidad: "Matafuego", entidadId: matafuego.id, accion: "STATUS_CHANGE" } }),
    );
    expect(logsMatafuego).toHaveLength(1);
  });

  it("una inspección de un tenant no es accesible desde otro (RLS)", async () => {
    const { adminActor: actorA, matafuego } = await setupMatafuego();
    const { adminActor: actorB } = await setupMatafuego();
    const inspeccion = await crearInspeccion(actorA, { matafuegoId: matafuego.id, resultado: "APTO" });

    await expect(getInspeccion(actorB, inspeccion.id)).rejects.toThrow();
  });
});

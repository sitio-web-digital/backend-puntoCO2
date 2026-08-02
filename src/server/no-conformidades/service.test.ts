import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { createCliente, type TenantActor } from "../clientes/service";
import { createEstablecimiento } from "../establecimientos/service";
import { createMatafuego } from "../matafuegos/service";
import { crearInspeccion } from "../inspecciones/service";
import { hashPassword } from "../auth/password";
import { ForbiddenError } from "../rbac/permissions";
import {
  crearNoConformidad,
  crearNoConformidadDesdeInspeccion,
  listNoConformidades,
  getNoConformidad,
  asignarResponsable,
  iniciarTratamiento,
  resolverNoConformidad,
  verificarNoConformidad,
  cerrarNoConformidad,
  descartarNoConformidad,
  estaVencida,
  MatafuegoAsociadoNotFoundError,
  InspeccionAsociadaInvalidaError,
  ResultadoInspeccionInvalidoError,
  ResponsableAsociadoInvalidoError,
  TransicionEstadoInvalidaError,
  TransicionRequiereReinspeccionInvalidaError,
} from "./service";

describe("gestión de no conformidades (RF-07)", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.noConformidad.deleteMany({ where: { tenantId } });
        await tx.inspeccion.deleteMany({ where: { tenantId } });
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

  async function setupMatafuego() {
    const unique = randomUUID().slice(0, 8);
    const { tenant, usuarioAdmin } = await createTenant(
      {
        nombre: `NC Test ${unique}`,
        slug: `nc-test-${unique}`,
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
      razonSocial: "Cliente NC SRL",
      condicionIva: "RESPONSABLE_INSCRIPTO",
      tipoConsumidor: "EMPRESA",
    });
    const establecimiento = await createEstablecimiento(adminActor, { clienteId: cliente.id, nombre: "Planta" });
    const matafuego = await createMatafuego(adminActor, {
      codigoInterno: `MAT-${unique}`,
      numeroSerie: `SN-${unique}`,
      clienteId: cliente.id,
      establecimientoId: establecimiento.id,
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

  function ncInputBase(matafuegoId: string, overrides: Partial<Parameters<typeof crearNoConformidad>[1]> = {}) {
    return {
      matafuegoId,
      tipoDefecto: "Manómetro fuera de rango",
      descripcion: "El manómetro marca por debajo del rango operativo",
      severidad: "MEDIA" as const,
      nivelRiesgo: "MEDIO" as const,
      ...overrides,
    };
  }

  it("registra una no conformidad vinculada a la unidad", async () => {
    const { adminActor, matafuego } = await setupMatafuego();
    const nc = await crearNoConformidad(adminActor, ncInputBase(matafuego.id));

    expect(nc.matafuegoId).toBe(matafuego.id);
    expect(nc.detectadaPorId).toBe(adminActor.usuarioId);
    expect(nc.estado).toBe("ABIERTA");
  });

  it("rechaza crear una no conformidad para un matafuego inexistente", async () => {
    const { adminActor } = await setupMatafuego();
    await expect(crearNoConformidad(adminActor, ncInputBase("no-existe"))).rejects.toThrow(MatafuegoAsociadoNotFoundError);
  });

  it("genera una no conformidad a partir de una inspección no conforme", async () => {
    const { adminActor, matafuego } = await setupMatafuego();
    const inspeccion = await crearInspeccion(adminActor, { matafuegoId: matafuego.id, resultado: "REQUIERE_MANTENIMIENTO" });

    const nc = await crearNoConformidadDesdeInspeccion(adminActor, inspeccion.id, {
      tipoDefecto: "Fuga",
      descripcion: "Pierde presión",
      severidad: "ALTA",
      nivelRiesgo: "ALTO",
    });

    expect(nc.matafuegoId).toBe(matafuego.id);
    expect(nc.inspeccionId).toBe(inspeccion.id);
  });

  it("rechaza generar una no conformidad desde una inspección APTO (no lo amerita)", async () => {
    const { adminActor, matafuego } = await setupMatafuego();
    const inspeccion = await crearInspeccion(adminActor, { matafuegoId: matafuego.id, resultado: "APTO" });

    await expect(
      crearNoConformidadDesdeInspeccion(adminActor, inspeccion.id, { tipoDefecto: "x", descripcion: "x", severidad: "BAJA", nivelRiesgo: "BAJO" }),
    ).rejects.toThrow(ResultadoInspeccionInvalidoError);
  });

  it("rechaza una inspección que no corresponde al matafuego indicado", async () => {
    const { adminActor, cliente, establecimiento, matafuego } = await setupMatafuego();
    const otroMatafuego = await createMatafuego(adminActor, {
      codigoInterno: `MAT-OTRO-${randomUUID().slice(0, 8)}`,
      numeroSerie: `SN-OTRO-${randomUUID().slice(0, 8)}`,
      clienteId: cliente.id,
      establecimientoId: establecimiento.id,
      tipo: "PORTATIL",
      agenteExtintor: "CO2",
    });
    const inspeccionDelPrimero = await crearInspeccion(adminActor, { matafuegoId: matafuego.id, resultado: "REQUIERE_MANTENIMIENTO" });

    await expect(
      crearNoConformidad(adminActor, ncInputBase(otroMatafuego.id, { inspeccionId: inspeccionDelPrimero.id })),
    ).rejects.toThrow(InspeccionAsociadaInvalidaError);
  });

  it("asigna un responsable: pasa de ABIERTA a ASIGNADA", async () => {
    const { tenant, adminActor, matafuego } = await setupMatafuego();
    const tecnico = await crearActorConRol(tenant.id, "Técnico de campo");
    const nc = await crearNoConformidad(adminActor, ncInputBase(matafuego.id));

    const asignada = await asignarResponsable(adminActor, nc.id, { responsableId: tecnico.usuarioId });
    expect(asignada.estado).toBe("ASIGNADA");
    expect(asignada.responsableId).toBe(tecnico.usuarioId);
  });

  it("rechaza asignar un responsable que no existe en el tenant", async () => {
    const { adminActor, matafuego } = await setupMatafuego();
    const nc = await crearNoConformidad(adminActor, ncInputBase(matafuego.id));

    await expect(asignarResponsable(adminActor, nc.id, { responsableId: "no-existe" })).rejects.toThrow(ResponsableAsociadoInvalidoError);
  });

  it("un técnico (alcance PROPIO en EDITAR) no puede asignar responsables (acción reservada a TODAS)", async () => {
    const { tenant, adminActor, matafuego } = await setupMatafuego();
    const tecnico = await crearActorConRol(tenant.id, "Técnico de campo");
    const nc = await crearNoConformidad(tecnico, ncInputBase(matafuego.id));

    await expect(asignarResponsable(tecnico, nc.id, { responsableId: tecnico.usuarioId })).rejects.toThrow(ForbiddenError);
    void adminActor;
  });

  it("el técnico responsable puede iniciar tratamiento y resolver lo suyo", async () => {
    const { tenant, adminActor, matafuego } = await setupMatafuego();
    const tecnico = await crearActorConRol(tenant.id, "Técnico de campo");
    const nc = await crearNoConformidad(adminActor, ncInputBase(matafuego.id));
    await asignarResponsable(adminActor, nc.id, { responsableId: tecnico.usuarioId });

    const enTratamiento = await iniciarTratamiento(tecnico, nc.id);
    expect(enTratamiento.estado).toBe("EN_TRATAMIENTO");

    const resuelta = await resolverNoConformidad(tecnico, nc.id, { resolucion: "Se reemplazó el manómetro" });
    expect(resuelta.estado).toBe("RESUELTA");
    expect(resuelta.resolucion).toBe("Se reemplazó el manómetro");
  });

  it("un técnico ajeno (ni la reportó ni es responsable) no puede tocarla", async () => {
    const { tenant, adminActor, matafuego } = await setupMatafuego();
    const tecnicoResponsable = await crearActorConRol(tenant.id, "Técnico de campo");
    const tecnicoAjeno = await crearActorConRol(tenant.id, "Técnico de campo");
    const nc = await crearNoConformidad(adminActor, ncInputBase(matafuego.id));
    await asignarResponsable(adminActor, nc.id, { responsableId: tecnicoResponsable.usuarioId });

    await expect(iniciarTratamiento(tecnicoAjeno, nc.id)).rejects.toThrow(ForbiddenError);
  });

  it("no se puede iniciar tratamiento sin haber asignado responsable primero", async () => {
    const { adminActor, matafuego } = await setupMatafuego();
    const nc = await crearNoConformidad(adminActor, ncInputBase(matafuego.id));

    await expect(iniciarTratamiento(adminActor, nc.id)).rejects.toThrow(TransicionEstadoInvalidaError);
  });

  it("verificar es una acción reservada a alcance TODAS, no la puede hacer el técnico que resolvió", async () => {
    const { tenant, adminActor, matafuego } = await setupMatafuego();
    const tecnico = await crearActorConRol(tenant.id, "Técnico de campo");
    const nc = await crearNoConformidad(adminActor, ncInputBase(matafuego.id));
    await asignarResponsable(adminActor, nc.id, { responsableId: tecnico.usuarioId });
    await resolverNoConformidad(tecnico, nc.id, { resolucion: "listo" });

    await expect(verificarNoConformidad(tecnico, nc.id)).rejects.toThrow(ForbiddenError);
    const verificada = await verificarNoConformidad(adminActor, nc.id);
    expect(verificada.estado).toBe("VERIFICADA");
  });

  it("no puede cerrarse una no conformidad resuelta que requiere reinspección sin pasar por VERIFICADA", async () => {
    const { adminActor, matafuego } = await setupMatafuego();
    const nc = await crearNoConformidad(adminActor, ncInputBase(matafuego.id, { reinspeccionRequerida: true }));
    await asignarResponsable(adminActor, nc.id, { responsableId: adminActor.usuarioId });
    await resolverNoConformidad(adminActor, nc.id, { resolucion: "reparado" });

    await expect(cerrarNoConformidad(adminActor, nc.id)).rejects.toThrow(TransicionRequiereReinspeccionInvalidaError);

    await verificarNoConformidad(adminActor, nc.id);
    const cerrada = await cerrarNoConformidad(adminActor, nc.id);
    expect(cerrada.estado).toBe("CERRADA");
  });

  it("una no conformidad sin reinspección requerida se cierra directo desde RESUELTA", async () => {
    const { adminActor, matafuego } = await setupMatafuego();
    const nc = await crearNoConformidad(adminActor, ncInputBase(matafuego.id, { reinspeccionRequerida: false }));
    await asignarResponsable(adminActor, nc.id, { responsableId: adminActor.usuarioId });
    await resolverNoConformidad(adminActor, nc.id, { resolucion: "reparado" });

    const cerrada = await cerrarNoConformidad(adminActor, nc.id);
    expect(cerrada.estado).toBe("CERRADA");
  });

  it("se puede descartar una no conformidad abierta (falso positivo)", async () => {
    const { adminActor, matafuego } = await setupMatafuego();
    const nc = await crearNoConformidad(adminActor, ncInputBase(matafuego.id));

    const descartada = await descartarNoConformidad(adminActor, nc.id, "falsa alarma");
    expect(descartada.estado).toBe("DESCARTADA");
  });

  it("no se puede descartar una no conformidad ya resuelta", async () => {
    const { adminActor, matafuego } = await setupMatafuego();
    const nc = await crearNoConformidad(adminActor, ncInputBase(matafuego.id));
    await asignarResponsable(adminActor, nc.id, { responsableId: adminActor.usuarioId });
    await resolverNoConformidad(adminActor, nc.id, { resolucion: "listo" });

    await expect(descartarNoConformidad(adminActor, nc.id)).rejects.toThrow(TransicionEstadoInvalidaError);
  });

  it("estaVencida es true sólo si pasó la fecha límite y el estado no es terminal", () => {
    const base = { fechaLimite: new Date(Date.now() - 86_400_000) };
    expect(estaVencida({ ...base, estado: "ABIERTA" })).toBe(true);
    expect(estaVencida({ ...base, estado: "EN_TRATAMIENTO" })).toBe(true);
    expect(estaVencida({ ...base, estado: "CERRADA" })).toBe(false);
    expect(estaVencida({ ...base, estado: "VERIFICADA" })).toBe(false);
    expect(estaVencida({ ...base, estado: "DESCARTADA" })).toBe(false);
    expect(estaVencida({ fechaLimite: null, estado: "ABIERTA" })).toBe(false);
    expect(estaVencida({ fechaLimite: new Date(Date.now() + 86_400_000), estado: "ABIERTA" })).toBe(false);
  });

  it("un técnico (alcance PROPIO) sólo lista las no conformidades que reportó o tiene asignadas", async () => {
    const { tenant, adminActor, matafuego } = await setupMatafuego();
    const tecnicoA = await crearActorConRol(tenant.id, "Técnico de campo");
    const tecnicoB = await crearActorConRol(tenant.id, "Técnico de campo");

    const ncDeA = await crearNoConformidad(tecnicoA, ncInputBase(matafuego.id));
    const ncAsignadaAA = await crearNoConformidad(adminActor, ncInputBase(matafuego.id));
    await asignarResponsable(adminActor, ncAsignadaAA.id, { responsableId: tecnicoA.usuarioId });
    await crearNoConformidad(tecnicoB, ncInputBase(matafuego.id));

    const listadoA = await listNoConformidades(tecnicoA);
    expect(listadoA.map((n) => n.id).sort()).toEqual([ncDeA.id, ncAsignadaAA.id].sort());
  });

  it("un auditor no puede crear no conformidades", async () => {
    const { tenant, matafuego } = await setupMatafuego();
    const auditor = await crearActorConRol(tenant.id, "Auditor");

    await expect(crearNoConformidad(auditor, ncInputBase(matafuego.id))).rejects.toThrow(ForbiddenError);
  });

  it("registra auditoría en cada transición de estado", async () => {
    const { tenant, adminActor, matafuego } = await setupMatafuego();
    const nc = await crearNoConformidad(adminActor, ncInputBase(matafuego.id));
    await asignarResponsable(adminActor, nc.id, { responsableId: adminActor.usuarioId });
    await resolverNoConformidad(adminActor, nc.id, { resolucion: "listo" });

    const logs = await withTenant({ tenantId: tenant.id }, (tx) =>
      tx.auditLog.findMany({ where: { entidad: "NoConformidad", entidadId: nc.id }, orderBy: { createdAt: "asc" } }),
    );
    expect(logs.map((l) => l.accion)).toEqual(["CREATE", "UPDATE", "STATUS_CHANGE"]);
  });

  it("una no conformidad de un tenant no es accesible desde otro (RLS)", async () => {
    const { adminActor: actorA, matafuego } = await setupMatafuego();
    const { adminActor: actorB } = await setupMatafuego();
    const nc = await crearNoConformidad(actorA, ncInputBase(matafuego.id));

    await expect(getNoConformidad(actorB, nc.id)).rejects.toThrow();
  });
});

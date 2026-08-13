import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { createCliente, type TenantActor } from "../clientes/service";
import { createEstablecimiento } from "../establecimientos/service";
import { createMatafuego } from "../matafuegos/service";
import { hashPassword } from "../auth/password";
import { ForbiddenError } from "../rbac/permissions";
import {
  crearReglaMantenimiento,
  listReglasMantenimiento,
  listReglasMantenimientoPaginado,
  desactivarReglaMantenimiento,
  calcularProximoMantenimiento,
  crearMantenimientoDesdeRegla,
  crearMantenimientoProgramado,
  listMantenimientos,
  listMantenimientosPaginado,
  getMantenimiento,
  reprogramarMantenimiento,
  marcarMantenimientoRealizado,
  cancelarMantenimiento,
  ClienteAsociadoNotFoundError,
  MotivoRetroactivoRequeridoInvalidoError,
  ReglaAplicableNotFoundError,
  TransicionMantenimientoInvalidaError,
  MantenimientoProgramadoNotFoundError,
} from "./service";

describe("programación de mantenimientos (RF-08)", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.mantenimientoProgramado.deleteMany({ where: { tenantId } });
        await tx.reglaMantenimiento.deleteMany({ where: { tenantId } });
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
        nombre: `Mant Test ${unique}`,
        slug: `mant-test-${unique}`,
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
      razonSocial: "Cliente Mant SRL",
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

  describe("reglas de mantenimiento", () => {
    it("crea una regla y la lista", async () => {
      const { adminActor } = await setupMatafuego();
      await crearReglaMantenimiento(adminActor, { tipoServicio: "RECARGA", frecuenciaMeses: 12 });

      const reglas = await listReglasMantenimiento(adminActor, { tipoServicio: "RECARGA" });
      expect(reglas).toHaveLength(1);
      expect(reglas[0]?.frecuenciaMeses).toBe(12);
    });

    it("rechaza una regla con clienteId inexistente", async () => {
      const { adminActor } = await setupMatafuego();
      await expect(crearReglaMantenimiento(adminActor, { clienteId: "no-existe", tipoServicio: "RECARGA", frecuenciaMeses: 12 })).rejects.toThrow(
        ClienteAsociadoNotFoundError,
      );
    });

    it("desactiva una regla (nunca se edita en el lugar)", async () => {
      const { adminActor, matafuego } = await setupMatafuego();
      const regla = await crearReglaMantenimiento(adminActor, { tipoServicio: "RECARGA", frecuenciaMeses: 12 });

      const desactivada = await desactivarReglaMantenimiento(adminActor, regla.id, "criterio actualizado");
      expect(desactivada.estado).toBe("INACTIVA");

      // Una regla inactiva no debe seguir siendo candidata para el cálculo.
      const resultado = (await calcularProximoMantenimiento(adminActor, matafuego.id, "RECARGA"))!;
      expect(resultado.proximaFecha).toBeNull();
    });
  });

  describe("cálculo de próximo mantenimiento (motor de reglas)", () => {
    it("sin ninguna regla aplicable, no calcula nada", async () => {
      const { adminActor, matafuego } = await setupMatafuego();
      const resultado = await calcularProximoMantenimiento(adminActor, matafuego.id, "RECARGA");
      expect(resultado).toEqual({ regla: null, proximaFecha: null });
    });

    it("usa una regla general (sin restricciones) cuando es la única candidata", async () => {
      const { tenant, adminActor, matafuego } = await setupMatafuego();
      await crearReglaMantenimiento(adminActor, { tipoServicio: "RECARGA", frecuenciaMeses: 12 });

      await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.matafuego.update({ where: { id: matafuego.id }, data: { fechaUltimaRecarga: new Date("2025-01-15") } }),
      );

      const resultado = (await calcularProximoMantenimiento(adminActor, matafuego.id, "RECARGA"))!;
      expect(resultado.regla).not.toBeNull();
      expect(resultado.proximaFecha?.toISOString().slice(0, 10)).toBe("2026-01-15");
    });

    it("prefiere la regla más específica (por cliente) sobre la general", async () => {
      const { tenant, adminActor, cliente, matafuego } = await setupMatafuego();
      await crearReglaMantenimiento(adminActor, { tipoServicio: "RECARGA", frecuenciaMeses: 12 });
      await crearReglaMantenimiento(adminActor, { clienteId: cliente.id, tipoServicio: "RECARGA", frecuenciaMeses: 6 });

      await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.matafuego.update({ where: { id: matafuego.id }, data: { fechaUltimaRecarga: new Date("2025-01-15") } }),
      );

      const resultado = (await calcularProximoMantenimiento(adminActor, matafuego.id, "RECARGA"))!;
      expect(resultado.regla?.frecuenciaMeses).toBe(6);
      expect(resultado.proximaFecha?.toISOString().slice(0, 10)).toBe("2025-07-15");
    });

    it("usa fechaPuestaServicio como base cuando la unidad nunca tuvo el servicio", async () => {
      const { tenant, adminActor, matafuego } = await setupMatafuego();
      await crearReglaMantenimiento(adminActor, { tipoServicio: "INSPECCION", frecuenciaMeses: 3 });
      await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.matafuego.update({ where: { id: matafuego.id }, data: { fechaPuestaServicio: new Date("2026-01-01") } }),
      );

      const resultado = (await calcularProximoMantenimiento(adminActor, matafuego.id, "INSPECCION"))!;
      expect(resultado.proximaFecha?.toISOString().slice(0, 10)).toBe("2026-04-01");
    });
  });

  describe("mantenimientos programados", () => {
    it("crea un mantenimiento a partir de una regla, calculando la fecha", async () => {
      const { tenant, adminActor, matafuego } = await setupMatafuego();
      await crearReglaMantenimiento(adminActor, { tipoServicio: "RECARGA", frecuenciaMeses: 12 });
      await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.matafuego.update({ where: { id: matafuego.id }, data: { fechaUltimaRecarga: new Date("2027-01-01") } }),
      );

      const mantenimiento = await crearMantenimientoDesdeRegla(adminActor, matafuego.id, "RECARGA");
      expect(mantenimiento.reglaAplicadaId).not.toBeNull();
      expect(mantenimiento.fechaProgramada.toISOString().slice(0, 10)).toBe("2028-01-01");
      expect(mantenimiento.estado).toBe("PROGRAMADO");
    });

    it("rechaza crear desde regla si no hay ninguna aplicable", async () => {
      const { adminActor, matafuego } = await setupMatafuego();
      await expect(crearMantenimientoDesdeRegla(adminActor, matafuego.id, "RECARGA")).rejects.toThrow(ReglaAplicableNotFoundError);
    });

    it("una unidad vencida según la regla (fecha calculada en el pasado) se programa como PENDIENTE, no como ya realizada", async () => {
      // Bug real encontrado en un smoke test manual: el motor de reglas
      // reusaba la misma validación de "carga retroactiva" de la creación
      // manual, así que programar algo vencido exigía motivo y lo marcaba
      // REALIZADO — como si la recarga ya se hubiera hecho, cuando en
      // realidad está pendiente y atrasada.
      const { tenant, adminActor, matafuego } = await setupMatafuego();
      await crearReglaMantenimiento(adminActor, { tipoServicio: "RECARGA", frecuenciaMeses: 12 });
      await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.matafuego.update({ where: { id: matafuego.id }, data: { fechaUltimaRecarga: new Date("2020-01-01") } }),
      );

      const mantenimiento = await crearMantenimientoDesdeRegla(adminActor, matafuego.id, "RECARGA");

      expect(mantenimiento.estado).toBe("PROGRAMADO");
      expect(mantenimiento.cargadoRetroactivamente).toBe(false);
      expect(mantenimiento.fechaProgramada.getTime()).toBeLessThan(Date.now());
    });

    it("una fecha programada futura queda disponible para el calendario", async () => {
      const { adminActor, matafuego } = await setupMatafuego();
      const fechaFutura = new Date(Date.now() + 30 * 86_400_000);
      const mantenimiento = await crearMantenimientoProgramado(adminActor, { matafuegoId: matafuego.id, tipoServicio: "MANTENIMIENTO", fechaProgramada: fechaFutura });

      expect(mantenimiento.estado).toBe("PROGRAMADO");
      const listado = await listMantenimientos(adminActor);
      expect(listado.map((m) => m.id)).toContain(mantenimiento.id);
    });

    it("exige motivo para cargar un mantenimiento con fecha pasada (retroactivo)", async () => {
      const { adminActor, matafuego } = await setupMatafuego();
      const fechaPasada = new Date(Date.now() - 30 * 86_400_000);

      await expect(
        crearMantenimientoProgramado(adminActor, { matafuegoId: matafuego.id, tipoServicio: "MANTENIMIENTO", fechaProgramada: fechaPasada }),
      ).rejects.toThrow(MotivoRetroactivoRequeridoInvalidoError);
    });

    it("con motivo, la carga retroactiva se registra como REALIZADO y queda auditada", async () => {
      const { tenant, adminActor, matafuego } = await setupMatafuego();
      const fechaPasada = new Date(Date.now() - 30 * 86_400_000);

      const mantenimiento = await crearMantenimientoProgramado(adminActor, {
        matafuegoId: matafuego.id,
        tipoServicio: "MANTENIMIENTO",
        fechaProgramada: fechaPasada,
        motivo: "se hizo en papel, nunca se cargó en el sistema",
      });

      expect(mantenimiento.estado).toBe("REALIZADO");
      expect(mantenimiento.cargadoRetroactivamente).toBe(true);

      const logs = await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.auditLog.findMany({ where: { entidad: "MantenimientoProgramado", entidadId: mantenimiento.id } }),
      );
      expect(logs[0]?.motivo).toBe("se hizo en papel, nunca se cargó en el sistema");
    });

    it("reprograma un mantenimiento, conservando la fecha anterior en el historial de auditoría", async () => {
      const { tenant, adminActor, matafuego } = await setupMatafuego();
      const fechaOriginal = new Date(Date.now() + 10 * 86_400_000);
      const mantenimiento = await crearMantenimientoProgramado(adminActor, { matafuegoId: matafuego.id, tipoServicio: "MANTENIMIENTO", fechaProgramada: fechaOriginal });

      const fechaNueva = new Date(Date.now() + 20 * 86_400_000);
      const reprogramado = await reprogramarMantenimiento(adminActor, mantenimiento.id, { fechaProgramada: fechaNueva });

      expect(reprogramado.estado).toBe("REPROGRAMADO");
      expect(reprogramado.fechaProgramada.getTime()).toBe(fechaNueva.getTime());

      const logs = await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.auditLog.findMany({ where: { entidad: "MantenimientoProgramado", entidadId: mantenimiento.id, accion: "UPDATE" } }),
      );
      const valorAnterior = logs[0]?.valorAnterior as { fechaProgramada: string } | null;
      expect(new Date(valorAnterior!.fechaProgramada).getTime()).toBe(fechaOriginal.getTime());
    });

    it("no se puede reprogramar un mantenimiento ya realizado", async () => {
      const { adminActor, matafuego } = await setupMatafuego();
      const fechaOriginal = new Date(Date.now() + 10 * 86_400_000);
      const mantenimiento = await crearMantenimientoProgramado(adminActor, { matafuegoId: matafuego.id, tipoServicio: "MANTENIMIENTO", fechaProgramada: fechaOriginal });
      await marcarMantenimientoRealizado(adminActor, mantenimiento.id);

      await expect(reprogramarMantenimiento(adminActor, mantenimiento.id, { fechaProgramada: new Date() })).rejects.toThrow(
        TransicionMantenimientoInvalidaError,
      );
    });

    it("marcar como realizado actualiza la fecha correspondiente del matafuego", async () => {
      const { tenant, adminActor, matafuego } = await setupMatafuego();
      const fechaProgramada = new Date(Date.now() + 5 * 86_400_000);
      const mantenimiento = await crearMantenimientoProgramado(adminActor, { matafuegoId: matafuego.id, tipoServicio: "RECARGA", fechaProgramada });

      const fechaRealizacion = new Date();
      await marcarMantenimientoRealizado(adminActor, mantenimiento.id, { fechaRealizacion });

      const actualizado = await withTenant({ tenantId: tenant.id }, (tx) => tx.matafuego.findUnique({ where: { id: matafuego.id } }));
      expect(actualizado?.fechaUltimaRecarga?.getTime()).toBe(fechaRealizacion.getTime());
    });

    it("cancela un mantenimiento programado", async () => {
      const { adminActor, matafuego } = await setupMatafuego();
      const mantenimiento = await crearMantenimientoProgramado(adminActor, {
        matafuegoId: matafuego.id,
        tipoServicio: "MANTENIMIENTO",
        fechaProgramada: new Date(Date.now() + 86_400_000),
      });

      const cancelado = await cancelarMantenimiento(adminActor, mantenimiento.id, "unidad dada de baja");
      expect(cancelado.estado).toBe("CANCELADO");
    });

    it("lista el calendario ordenado por fecha programada ascendente", async () => {
      const { adminActor, matafuego } = await setupMatafuego();
      const m1 = await crearMantenimientoProgramado(adminActor, {
        matafuegoId: matafuego.id,
        tipoServicio: "MANTENIMIENTO",
        fechaProgramada: new Date(Date.now() + 20 * 86_400_000),
      });
      const m2 = await crearMantenimientoProgramado(adminActor, {
        matafuegoId: matafuego.id,
        tipoServicio: "MANTENIMIENTO",
        fechaProgramada: new Date(Date.now() + 5 * 86_400_000),
      });

      const listado = await listMantenimientos(adminActor, { matafuegoId: matafuego.id });
      expect(listado.map((m) => m.id)).toEqual([m2.id, m1.id]);
    });

    it("un técnico (alcance PROPIO) sólo ve lo que tiene asignado", async () => {
      const { tenant, adminActor, matafuego } = await setupMatafuego();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");

      const asignado = await crearMantenimientoProgramado(adminActor, {
        matafuegoId: matafuego.id,
        tipoServicio: "MANTENIMIENTO",
        fechaProgramada: new Date(Date.now() + 86_400_000),
        tecnicoAsignadoId: tecnico.usuarioId,
      });
      await crearMantenimientoProgramado(adminActor, {
        matafuegoId: matafuego.id,
        tipoServicio: "MANTENIMIENTO",
        fechaProgramada: new Date(Date.now() + 2 * 86_400_000),
      });

      const listadoTecnico = await listMantenimientos(tecnico);
      expect(listadoTecnico.map((m) => m.id)).toEqual([asignado.id]);
    });

    it("un técnico no puede crear ni reprogramar mantenimientos (sólo VER)", async () => {
      const { tenant, adminActor, matafuego } = await setupMatafuego();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");

      await expect(
        crearMantenimientoProgramado(tecnico, { matafuegoId: matafuego.id, tipoServicio: "MANTENIMIENTO", fechaProgramada: new Date(Date.now() + 86_400_000) }),
      ).rejects.toThrow(ForbiddenError);

      const mantenimiento = await crearMantenimientoProgramado(adminActor, {
        matafuegoId: matafuego.id,
        tipoServicio: "MANTENIMIENTO",
        fechaProgramada: new Date(Date.now() + 86_400_000),
      });
      await expect(reprogramarMantenimiento(tecnico, mantenimiento.id, { fechaProgramada: new Date() })).rejects.toThrow(ForbiddenError);
    });

    it("lanza MantenimientoProgramadoNotFoundError sobre un id inexistente", async () => {
      const { adminActor } = await setupMatafuego();
      await expect(cancelarMantenimiento(adminActor, "no-existe")).rejects.toThrow(MantenimientoProgramadoNotFoundError);
    });

    it("un mantenimiento de un tenant no es accesible desde otro (RLS)", async () => {
      const { adminActor: actorA, matafuego } = await setupMatafuego();
      const { adminActor: actorB } = await setupMatafuego();
      const mantenimiento = await crearMantenimientoProgramado(actorA, {
        matafuegoId: matafuego.id,
        tipoServicio: "MANTENIMIENTO",
        fechaProgramada: new Date(Date.now() + 86_400_000),
      });

      await expect(getMantenimiento(actorB, mantenimiento.id)).rejects.toThrow();
    });
  });

  describe("calendario paginado", () => {
    it("devuelve la primera página con el tamaño y el total correctos", async () => {
      const { adminActor, matafuego } = await setupMatafuego();
      for (let i = 0; i < 5; i++) {
        await crearMantenimientoProgramado(adminActor, {
          matafuegoId: matafuego.id,
          tipoServicio: "MANTENIMIENTO",
          fechaProgramada: new Date(Date.now() + (i + 1) * 86_400_000),
        });
      }

      const pagina = await listMantenimientosPaginado(adminActor, { page: 1, pageSize: 2 });

      expect(pagina.total).toBe(5);
      expect(pagina.totalPages).toBe(3);
      expect(pagina.page).toBe(1);
      expect(pagina.pageSize).toBe(2);
      expect(pagina.items).toHaveLength(2);
    });

    it("la segunda página trae registros distintos de la primera", async () => {
      const { adminActor, matafuego } = await setupMatafuego();
      for (let i = 0; i < 5; i++) {
        await crearMantenimientoProgramado(adminActor, {
          matafuegoId: matafuego.id,
          tipoServicio: "MANTENIMIENTO",
          fechaProgramada: new Date(Date.now() + (i + 1) * 86_400_000),
        });
      }

      const pagina1 = await listMantenimientosPaginado(adminActor, { page: 1, pageSize: 2 });
      const pagina2 = await listMantenimientosPaginado(adminActor, { page: 2, pageSize: 2 });

      const idsPagina1 = new Set(pagina1.items.map((m) => m.id));
      const idsPagina2 = new Set(pagina2.items.map((m) => m.id));
      expect([...idsPagina1].some((id) => idsPagina2.has(id))).toBe(false);
    });

    it("una página fuera de rango devuelve una lista vacía sin romper, manteniendo el total real", async () => {
      const { adminActor, matafuego } = await setupMatafuego();
      await crearMantenimientoProgramado(adminActor, {
        matafuegoId: matafuego.id,
        tipoServicio: "MANTENIMIENTO",
        fechaProgramada: new Date(Date.now() + 86_400_000),
      });

      const pagina = await listMantenimientosPaginado(adminActor, { page: 99, pageSize: 10 });

      expect(pagina.items).toHaveLength(0);
      expect(pagina.total).toBe(1);
    });

    it("un técnico (alcance PROPIO) sólo ve en el paginado lo que tiene asignado", async () => {
      const { tenant, adminActor, matafuego } = await setupMatafuego();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");

      const asignado = await crearMantenimientoProgramado(adminActor, {
        matafuegoId: matafuego.id,
        tipoServicio: "MANTENIMIENTO",
        fechaProgramada: new Date(Date.now() + 86_400_000),
        tecnicoAsignadoId: tecnico.usuarioId,
      });
      await crearMantenimientoProgramado(adminActor, {
        matafuegoId: matafuego.id,
        tipoServicio: "MANTENIMIENTO",
        fechaProgramada: new Date(Date.now() + 2 * 86_400_000),
      });

      const pagina = await listMantenimientosPaginado(tecnico, { page: 1 });

      expect(pagina.items.map((m) => m.id)).toEqual([asignado.id]);
      expect(pagina.total).toBe(1);
    });
  });

  describe("reglas paginado", () => {
    it("devuelve la primera página con el tamaño y el total correctos", async () => {
      const { adminActor } = await setupMatafuego();
      for (let i = 0; i < 5; i++) {
        await crearReglaMantenimiento(adminActor, { tipoServicio: "RECARGA", frecuenciaMeses: 12 + i });
      }

      const pagina = await listReglasMantenimientoPaginado(adminActor, { page: 1, pageSize: 2 });

      expect(pagina.total).toBe(5);
      expect(pagina.totalPages).toBe(3);
      expect(pagina.page).toBe(1);
      expect(pagina.pageSize).toBe(2);
      expect(pagina.items).toHaveLength(2);
    });

    it("la segunda página trae registros distintos de la primera", async () => {
      const { adminActor } = await setupMatafuego();
      for (let i = 0; i < 5; i++) {
        await crearReglaMantenimiento(adminActor, { tipoServicio: "RECARGA", frecuenciaMeses: 12 + i });
      }

      const pagina1 = await listReglasMantenimientoPaginado(adminActor, { page: 1, pageSize: 2 });
      const pagina2 = await listReglasMantenimientoPaginado(adminActor, { page: 2, pageSize: 2 });

      const idsPagina1 = new Set(pagina1.items.map((r) => r.id));
      const idsPagina2 = new Set(pagina2.items.map((r) => r.id));
      expect([...idsPagina1].some((id) => idsPagina2.has(id))).toBe(false);
    });

    it("una página fuera de rango devuelve una lista vacía sin romper, manteniendo el total real", async () => {
      const { adminActor } = await setupMatafuego();
      await crearReglaMantenimiento(adminActor, { tipoServicio: "RECARGA", frecuenciaMeses: 12 });

      const pagina = await listReglasMantenimientoPaginado(adminActor, { page: 99, pageSize: 10 });

      expect(pagina.items).toHaveLength(0);
      expect(pagina.total).toBe(1);
    });

    it("un técnico (alcance PROPIO en VER) no ve nada en el paginado de reglas: es un recurso administrativo (fail closed)", async () => {
      const { tenant, adminActor } = await setupMatafuego();
      await crearReglaMantenimiento(adminActor, { tipoServicio: "RECARGA", frecuenciaMeses: 12 });
      const tecnico = await crearActorConRol(tenant.id, "Técnico");

      const pagina = await listReglasMantenimientoPaginado(tecnico, { page: 1 });

      expect(pagina.items).toHaveLength(0);
      expect(pagina.total).toBe(0);
    });
  });
});

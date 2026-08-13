import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { createCliente, type TenantActor } from "../clientes/service";
import { createEstablecimiento } from "../establecimientos/service";
import { createMatafuego } from "../matafuegos/service";
import { crearOrdenTrabajo } from "../ordenes-trabajo/service";
import { hashPassword } from "../auth/password";
import { ForbiddenError } from "../rbac/permissions";
import {
  registrarRetiro,
  ingresarATaller,
  actualizarUbicacionInterna,
  iniciarTraslado,
  registrarEntrega,
  cancelarRetiroEntrega,
  listRetirosEntregas,
  listRetirosEntregasPaginado,
  getRetiroEntrega,
  RetiroEntregaNotFoundError,
  MatafuegoAsociadoNotFoundError,
  MatafuegoNoRetirableInvalidoError,
  TransicionRetiroEntregaInvalidaError,
  MotivoCancelacionRequeridoInvalidoError,
} from "./service";

describe("retiro, traslado y cadena de custodia (RF-12)", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.notificacion.deleteMany({ where: { tenantId } });
        await tx.retiroEntrega.deleteMany({ where: { tenantId } });
        await tx.ordenTrabajoItem.deleteMany({ where: { tenantId } });
        await tx.ordenTrabajoUnidad.deleteMany({ where: { tenantId } });
        await tx.ordenTrabajo.deleteMany({ where: { tenantId } });
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

  async function setupBase() {
    const unique = randomUUID().slice(0, 8);
    const { tenant, usuarioAdmin } = await createTenant(
      {
        nombre: `Retiro Test ${unique}`,
        slug: `retiro-test-${unique}`,
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
      razonSocial: "Cliente Retiro SRL",
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

  /** Rol ad-hoc de sólo lectura (VER:TODAS sobre RETIROS_ENTREGAS, sin
   * ningún permiso de escritura) — a diferencia del catálogo anterior
   * ("Operador de taller"), el rol "Técnico" fusionado sí puede CREAR
   * retiros/entregas (RF-12), así que este caso ya no lo cubre ningún rol
   * de plantilla y se arma a medida. */
  async function crearActorSoloLectura(tenantId: string) {
    const unique = randomUUID().slice(0, 8);
    const passwordHash = await hashPassword("clave-de-prueba-segura-123");
    return withTenant({ tenantId }, async (tx) => {
      const rol = await tx.rol.create({
        data: {
          tenantId,
          nombre: `Solo lectura ${unique}`,
          permisos: { create: { recurso: "RETIROS_ENTREGAS", accion: "VER", alcance: "TODAS" } },
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

  describe("registrar retiro", () => {
    it("sin destino, registra el retiro en estado RETIRADO y actualiza la unidad", async () => {
      const { tenant, adminActor, matafuego } = await setupBase();
      const registro = await registrarRetiro(adminActor, { matafuegoId: matafuego.id, personaQueEntrega: "Juan Pérez" });

      expect(registro.estado).toBe("RETIRADO");

      const actualizado = await withTenant({ tenantId: tenant.id }, (tx) => tx.matafuego.findUniqueOrThrow({ where: { id: matafuego.id } }));
      expect(actualizado.estado).toBe("RETIRADO");
    });

    it("con destino, registra el retiro directo en EN_TRASLADO", async () => {
      const { tenant, adminActor, matafuego } = await setupBase();
      const registro = await registrarRetiro(adminActor, { matafuegoId: matafuego.id, destino: "Taller central" });

      expect(registro.estado).toBe("EN_TRASLADO");
      const actualizado = await withTenant({ tenantId: tenant.id }, (tx) => tx.matafuego.findUniqueOrThrow({ where: { id: matafuego.id } }));
      expect(actualizado.estado).toBe("EN_TRASLADO");
    });

    it("rechaza retirar una unidad que ya está en algún punto del ciclo de custodia", async () => {
      const { adminActor, matafuego } = await setupBase();
      await registrarRetiro(adminActor, { matafuegoId: matafuego.id });

      await expect(registrarRetiro(adminActor, { matafuegoId: matafuego.id })).rejects.toThrow(MatafuegoNoRetirableInvalidoError);
    });

    it("rechaza un matafuego inexistente", async () => {
      const { adminActor } = await setupBase();
      await expect(registrarRetiro(adminActor, { matafuegoId: "no-existe" })).rejects.toThrow(MatafuegoAsociadoNotFoundError);
    });

    it("vincula la orden de trabajo cuando se indica", async () => {
      const { adminActor, cliente, matafuego } = await setupBase();
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id, matafuegoIds: [matafuego.id] });

      const registro = await registrarRetiro(adminActor, { matafuegoId: matafuego.id, ordenTrabajoId: orden.id });
      expect(registro.ordenTrabajoId).toBe(orden.id);
    });

    it("un técnico de campo (CREAR:PROPIO) registra el retiro asignándose a sí mismo como responsable", async () => {
      const { tenant, matafuego } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");

      const registro = await registrarRetiro(tecnico, { matafuegoId: matafuego.id });
      expect(registro.tecnicoResponsableId).toBe(tecnico.usuarioId);
    });

    it("un técnico de campo no puede registrar un retiro a nombre de otro usuario", async () => {
      const { tenant, adminActor, matafuego } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");

      await expect(
        registrarRetiro(tecnico, { matafuegoId: matafuego.id, tecnicoResponsableId: adminActor.usuarioId }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("un rol sin CREAR (sólo VER) no puede registrar retiros", async () => {
      const { tenant, matafuego } = await setupBase();
      const soloLecturaActor = await crearActorSoloLectura(tenant.id);
      await expect(registrarRetiro(soloLecturaActor, { matafuegoId: matafuego.id })).rejects.toThrow(ForbiddenError);
    });
  });

  describe("ciclo de custodia completo", () => {
    it("recorre RETIRADO -> EN_TRASLADO -> EN_TALLER -> ENTREGADO, actualizando la unidad en cada paso", async () => {
      const { tenant, adminActor, matafuego } = await setupBase();

      let registro = await registrarRetiro(adminActor, { matafuegoId: matafuego.id });
      expect(registro.estado).toBe("RETIRADO");

      registro = await iniciarTraslado(adminActor, registro.id);
      expect(registro.estado).toBe("EN_TRASLADO");

      registro = await ingresarATaller(adminActor, registro.id, { personaQueRecibe: "Depósito Central" });
      expect(registro.estado).toBe("EN_TALLER");
      expect(registro.fechaHoraIngresoTaller).not.toBeNull();

      registro = await actualizarUbicacionInterna(adminActor, registro.id, { ubicacionInterna: "Estante 4" });
      expect(registro.ubicacionInterna).toBe("Estante 4");

      registro = await registrarEntrega(adminActor, registro.id, { personaQueRecibe: "Cliente Final", firmaRecepcionNombre: "Juan Pérez" });
      expect(registro.estado).toBe("ENTREGADO");
      expect(registro.firmaRecepcionNombre).toBe("Juan Pérez");

      const unidad = await withTenant({ tenantId: tenant.id }, (tx) => tx.matafuego.findUniqueOrThrow({ where: { id: matafuego.id } }));
      expect(unidad.estado).toBe("ENTREGADO");
    });

    it("ingresarATaller transfiere la custodia a quien recibe, aunque no fuera el responsable previo", async () => {
      const { tenant, matafuego } = await setupBase();
      const tecnicoCampo = await crearActorConRol(tenant.id, "Técnico");
      const operadorTaller = await crearActorConRol(tenant.id, "Técnico");

      const registro = await registrarRetiro(tecnicoCampo, { matafuegoId: matafuego.id });
      expect(registro.tecnicoResponsableId).toBe(tecnicoCampo.usuarioId);

      const recibido = await ingresarATaller(operadorTaller, registro.id, { personaQueRecibe: "Operador" });
      expect(recibido.tecnicoResponsableId).toBe(operadorTaller.usuarioId);

      // Ahora que la custodia es del operador de taller, el técnico de campo original ya no puede editarlo.
      await expect(actualizarUbicacionInterna(tecnicoCampo, registro.id, { ubicacionInterna: "Estante 1" })).rejects.toThrow(ForbiddenError);

      // El operador de taller, en cambio, sí puede.
      const actualizado = await actualizarUbicacionInterna(operadorTaller, registro.id, { ubicacionInterna: "Estante 1" });
      expect(actualizado.ubicacionInterna).toBe("Estante 1");
    });

    it("permite entregar directamente sin pasar por el taller", async () => {
      const { adminActor, matafuego } = await setupBase();
      const registro = await registrarRetiro(adminActor, { matafuegoId: matafuego.id });

      const entregado = await registrarEntrega(adminActor, registro.id, { personaQueRecibe: "Cliente", firmaRecepcionNombre: "Firma" });
      expect(entregado.estado).toBe("ENTREGADO");
    });

    it("rechaza una transición fuera de orden", async () => {
      const { adminActor, matafuego } = await setupBase();
      const registro = await registrarRetiro(adminActor, { matafuegoId: matafuego.id, destino: "Taller" });

      await expect(iniciarTraslado(adminActor, registro.id)).rejects.toThrow(TransicionRetiroEntregaInvalidaError);
    });

    it("cancelar exige un motivo y está reservado a alcance TODAS", async () => {
      const { tenant, adminActor, matafuego } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");
      const registro = await registrarRetiro(adminActor, { matafuegoId: matafuego.id });

      await expect(cancelarRetiroEntrega(adminActor, registro.id, "")).rejects.toThrow(MotivoCancelacionRequeridoInvalidoError);
      await expect(cancelarRetiroEntrega(tecnico, registro.id, "motivo")).rejects.toThrow(ForbiddenError);

      const cancelado = await cancelarRetiroEntrega(adminActor, registro.id, "unidad ya no requiere retiro");
      expect(cancelado.estado).toBe("CANCELADO");
    });
  });

  describe("visibilidad y alcance", () => {
    it("un técnico (alcance PROPIO) sólo lista los registros que tiene bajo su custodia", async () => {
      const { tenant, adminActor, matafuego, cliente, establecimiento } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");

      const propio = await registrarRetiro(tecnico, { matafuegoId: matafuego.id });

      const matafuego2 = await createMatafuego(adminActor, {
        codigoInterno: "MAT-OTRO",
        numeroSerie: "SN-OTRO",
        clienteId: cliente.id,
        establecimientoId: establecimiento.id,
        tipo: "PORTATIL",
        agenteExtintor: "CO2",
      });
      await registrarRetiro(adminActor, { matafuegoId: matafuego2.id });

      const listado = await listRetirosEntregas(tecnico);
      expect(listado.map((r) => r.id)).toEqual([propio.id]);
    });

    it("lanza RetiroEntregaNotFoundError sobre un id inexistente", async () => {
      const { adminActor } = await setupBase();
      await expect(getRetiroEntrega(adminActor, "no-existe")).rejects.toThrow(RetiroEntregaNotFoundError);
    });

    it("un registro de un tenant no es accesible desde otro (RLS)", async () => {
      const { adminActor: actorA, matafuego } = await setupBase();
      const { adminActor: actorB } = await setupBase();
      const registro = await registrarRetiro(actorA, { matafuegoId: matafuego.id });

      await expect(getRetiroEntrega(actorB, registro.id)).rejects.toThrow();
    });
  });

  describe("listado paginado", () => {
    it("devuelve la primera página con el tamaño y el total correctos", async () => {
      const { adminActor, cliente, establecimiento } = await setupBase();
      for (let i = 0; i < 5; i++) {
        const matafuego = await createMatafuego(adminActor, {
          codigoInterno: `MAT-PAG-${i}`,
          numeroSerie: `SN-PAG-${i}`,
          clienteId: cliente.id,
          establecimientoId: establecimiento.id,
          tipo: "PORTATIL",
          agenteExtintor: "CO2",
        });
        await registrarRetiro(adminActor, { matafuegoId: matafuego.id });
      }

      const pagina = await listRetirosEntregasPaginado(adminActor, { page: 1, pageSize: 2 });

      expect(pagina.total).toBe(5);
      expect(pagina.totalPages).toBe(3);
      expect(pagina.page).toBe(1);
      expect(pagina.pageSize).toBe(2);
      expect(pagina.items).toHaveLength(2);
    });

    it("la segunda página trae registros distintos de la primera", async () => {
      const { adminActor, cliente, establecimiento } = await setupBase();
      for (let i = 0; i < 5; i++) {
        const matafuego = await createMatafuego(adminActor, {
          codigoInterno: `MAT-PAG2-${i}`,
          numeroSerie: `SN-PAG2-${i}`,
          clienteId: cliente.id,
          establecimientoId: establecimiento.id,
          tipo: "PORTATIL",
          agenteExtintor: "CO2",
        });
        await registrarRetiro(adminActor, { matafuegoId: matafuego.id });
      }

      const pagina1 = await listRetirosEntregasPaginado(adminActor, { page: 1, pageSize: 2 });
      const pagina2 = await listRetirosEntregasPaginado(adminActor, { page: 2, pageSize: 2 });

      const idsPagina1 = new Set(pagina1.items.map((r) => r.id));
      const idsPagina2 = new Set(pagina2.items.map((r) => r.id));
      expect([...idsPagina1].some((id) => idsPagina2.has(id))).toBe(false);
    });

    it("una página fuera de rango devuelve una lista vacía sin romper, manteniendo el total real", async () => {
      const { adminActor, matafuego } = await setupBase();
      await registrarRetiro(adminActor, { matafuegoId: matafuego.id });

      const pagina = await listRetirosEntregasPaginado(adminActor, { page: 99, pageSize: 10 });

      expect(pagina.items).toHaveLength(0);
      expect(pagina.total).toBe(1);
    });

    it("un técnico (alcance PROPIO) sólo ve en el listado paginado los registros que tiene bajo su custodia", async () => {
      // Igual que en listRetirosEntregas ("visibilidad y alcance" arriba):
      // "Técnico" tiene alcance PROPIO resoluble para este recurso,
      // así que ve sus propios registros en vez de una lista vacía.
      const { tenant, adminActor, matafuego, cliente, establecimiento } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");

      const propio = await registrarRetiro(tecnico, { matafuegoId: matafuego.id });

      const matafuego2 = await createMatafuego(adminActor, {
        codigoInterno: "MAT-OTRO-PAG",
        numeroSerie: "SN-OTRO-PAG",
        clienteId: cliente.id,
        establecimientoId: establecimiento.id,
        tipo: "PORTATIL",
        agenteExtintor: "CO2",
      });
      await registrarRetiro(adminActor, { matafuegoId: matafuego2.id });

      const pagina = await listRetirosEntregasPaginado(tecnico, { page: 1 });

      expect(pagina.items.map((r) => r.id)).toEqual([propio.id]);
      expect(pagina.total).toBe(1);
    });
  });
});

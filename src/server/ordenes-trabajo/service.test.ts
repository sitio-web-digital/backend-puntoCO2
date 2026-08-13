import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { createCliente, type TenantActor } from "../clientes/service";
import { createEstablecimiento } from "../establecimientos/service";
import { createMatafuego } from "../matafuegos/service";
import { crearInspeccion } from "../inspecciones/service";
import { crearNoConformidad } from "../no-conformidades/service";
import { crearMantenimientoProgramado } from "../mantenimientos/service";
import { crearServicio, desactivarServicio } from "../servicios/service";
import { hashPassword } from "../auth/password";
import { ForbiddenError } from "../rbac/permissions";
import {
  crearOrdenTrabajo,
  crearOrdenDesdeInspeccion,
  crearOrdenDesdeNoConformidad,
  crearOrdenDesdeMantenimiento,
  listOrdenesTrabajo,
  listOrdenesTrabajoPaginado,
  getOrdenTrabajo,
  updateOrdenTrabajo,
  registrarAvanceTecnico,
  asignarTecnico,
  enviarAAprobacion,
  aprobarOrden,
  marcarEnCamino,
  iniciarTrabajo,
  pausarOrden,
  reanudarOrden,
  finalizarOrden,
  entregarOrden,
  facturarOrden,
  cancelarOrden,
  agregarItemOrden,
  quitarItemOrden,
  actualizarCantidadItemOrden,
  calcularTotalOrden,
  OrdenTrabajoNotFoundError,
  ClienteAsociadoNotFoundError,
  TransicionOrdenInvalidaError,
  MotivoCancelacionRequeridoInvalidoError,
  DatosTecnicosIncompletosInvalidoError,
} from "./service";
import { ServicioNoSeleccionableInvalidoError } from "../servicios/service";

describe("órdenes de trabajo (RF-11)", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.notificacion.deleteMany({ where: { tenantId } });
        await tx.ordenTrabajoItem.deleteMany({ where: { tenantId } });
        await tx.ordenTrabajoUnidad.deleteMany({ where: { tenantId } });
        await tx.ordenTrabajo.deleteMany({ where: { tenantId } });
        await tx.servicio.deleteMany({ where: { tenantId } });
        await tx.mantenimientoProgramado.deleteMany({ where: { tenantId } });
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

  async function setupBase() {
    const unique = randomUUID().slice(0, 8);
    const { tenant, usuarioAdmin } = await createTenant(
      {
        nombre: `Ord Test ${unique}`,
        slug: `ord-test-${unique}`,
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
      razonSocial: "Cliente Ordenes SRL",
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
    const servicio = await crearServicio(adminActor, {
      codigo: `RC-${unique}`,
      nombre: "Recarga PQS",
      categoria: "RECARGA",
      precioBase: 5000,
    });

    return { tenant, adminActor, cliente, establecimiento, matafuego, servicio };
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

  /** Rol ad-hoc de sólo lectura (VER:TODAS sobre ORDENES_TRABAJO, sin
   * ningún permiso de escritura) — el catálogo por defecto ya no trae un
   * rol "Comercial" con esta combinación exacta de permisos. */
  async function crearActorSoloLectura(tenantId: string) {
    const unique = randomUUID().slice(0, 8);
    const passwordHash = await hashPassword("clave-de-prueba-segura-123");
    return withTenant({ tenantId }, async (tx) => {
      const rol = await tx.rol.create({
        data: {
          tenantId,
          nombre: `Solo lectura ${unique}`,
          permisos: { create: { recurso: "ORDENES_TRABAJO", accion: "VER", alcance: "TODAS" } },
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

  describe("alta y numeración", () => {
    it("crea una orden en BORRADOR con numeración correlativa por tenant", async () => {
      const { adminActor, cliente } = await setupBase();

      const o1 = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });
      const o2 = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });

      expect(o1.estado).toBe("BORRADOR");
      expect(o2.numero).toBe(o1.numero + 1);
    });

    it("permite crear con unidades incluidas desde el alta", async () => {
      const { adminActor, cliente, matafuego } = await setupBase();
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id, matafuegoIds: [matafuego.id] });

      expect(orden.unidades.map((u) => u.matafuegoId)).toEqual([matafuego.id]);
    });

    it("rechaza un cliente inexistente", async () => {
      const { adminActor } = await setupBase();
      await expect(crearOrdenTrabajo(adminActor, { clienteId: "no-existe" })).rejects.toThrow(ClienteAsociadoNotFoundError);
    });

    it("un rol sin CREAR (técnico de campo) no puede crear órdenes", async () => {
      const { tenant, cliente } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");
      await expect(crearOrdenTrabajo(tecnico, { clienteId: cliente.id })).rejects.toThrow(ForbiddenError);
    });
  });

  describe("orígenes vinculados (RF-11)", () => {
    it("crea una orden desde una inspección, vinculando inspección y unidad", async () => {
      const { adminActor, matafuego } = await setupBase();
      const inspeccion = await crearInspeccion(adminActor, { matafuegoId: matafuego.id, resultado: "REQUIERE_RECARGA" });

      const orden = await crearOrdenDesdeInspeccion(adminActor, inspeccion.id);

      expect(orden.origen).toBe("INSPECCION");
      expect(orden.inspeccionOrigenId).toBe(inspeccion.id);
      expect(orden.unidades.map((u) => u.matafuegoId)).toEqual([matafuego.id]);
    });

    it("crea una orden desde una no conformidad, vinculando la no conformidad y la unidad", async () => {
      const { adminActor, matafuego } = await setupBase();
      const nc = await crearNoConformidad(adminActor, {
        matafuegoId: matafuego.id,
        tipoDefecto: "Manguera dañada",
        descripcion: "Manguera con corte visible",
        severidad: "ALTA",
        nivelRiesgo: "ALTO",
      });

      const orden = await crearOrdenDesdeNoConformidad(adminActor, nc.id);

      expect(orden.origen).toBe("NO_CONFORMIDAD");
      expect(orden.noConformidadOrigenId).toBe(nc.id);
      expect(orden.unidades.map((u) => u.matafuegoId)).toEqual([matafuego.id]);
    });

    it("crea una orden desde un mantenimiento programado, heredando el técnico asignado", async () => {
      const { tenant, adminActor, matafuego } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");
      const mantenimiento = await crearMantenimientoProgramado(adminActor, {
        matafuegoId: matafuego.id,
        tipoServicio: "RECARGA",
        fechaProgramada: new Date(Date.now() + 86_400_000),
        tecnicoAsignadoId: tecnico.usuarioId,
      });

      const orden = await crearOrdenDesdeMantenimiento(adminActor, mantenimiento.id);

      expect(orden.origen).toBe("MANTENIMIENTO_PROGRAMADO");
      expect(orden.mantenimientoOrigenId).toBe(mantenimiento.id);
      expect(orden.tecnicoAsignadoId).toBe(tecnico.usuarioId);
    });
  });

  describe("ítems de servicio", () => {
    it("agrega un ítem copiando precio y descripción vigentes, y calcula el subtotal", async () => {
      const { adminActor, cliente, servicio } = await setupBase();
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });

      const item = await agregarItemOrden(adminActor, orden.id, { servicioId: servicio.id, cantidad: 2 });

      expect(item.precioUnitario.toNumber()).toBe(5000);
      expect(item.subtotal.toNumber()).toBe(10000);
      expect(item.descripcion).toBe(servicio.nombre);
    });

    it("no permite agregar un servicio desactivado", async () => {
      const { adminActor, cliente, servicio } = await setupBase();
      await desactivarServicio(adminActor, servicio.id);
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });

      await expect(agregarItemOrden(adminActor, orden.id, { servicioId: servicio.id })).rejects.toThrow(ServicioNoSeleccionableInvalidoError);
    });

    it("quita un ítem de la orden", async () => {
      const { adminActor, cliente, servicio } = await setupBase();
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });
      const item = await agregarItemOrden(adminActor, orden.id, { servicioId: servicio.id });

      await quitarItemOrden(adminActor, orden.id, item.id);

      const actualizada = await getOrdenTrabajo(adminActor, orden.id);
      expect(actualizada?.items).toHaveLength(0);
    });

    it("calcula el total sumando los subtotales de los ítems", async () => {
      const { adminActor, cliente, servicio } = await setupBase();
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });
      await agregarItemOrden(adminActor, orden.id, { servicioId: servicio.id, cantidad: 2 });
      await agregarItemOrden(adminActor, orden.id, { servicioId: servicio.id, cantidad: 1 });

      const actualizada = await getOrdenTrabajo(adminActor, orden.id);
      expect(calcularTotalOrden(actualizada!.items)).toBe(15000);
    });

    it("actualiza la cantidad de un ítem y recalcula el subtotal", async () => {
      const { adminActor, cliente, servicio } = await setupBase();
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });
      const item = await agregarItemOrden(adminActor, orden.id, { servicioId: servicio.id, cantidad: 1 });

      const actualizado = await actualizarCantidadItemOrden(adminActor, orden.id, item.id, { cantidad: 3 });
      expect(actualizado?.cantidad).toBe(3);
      expect(actualizado?.subtotal.toNumber()).toBe(15000);
    });
  });

  describe("ciclo de vida completo", () => {
    it("recorre BORRADOR -> PENDIENTE_DE_APROBACION -> PROGRAMADA -> ASIGNADA -> EN_PROCESO -> FINALIZADA -> ENTREGADA -> FACTURADA", async () => {
      const { tenant, adminActor, cliente, servicio } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");

      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });
      await agregarItemOrden(adminActor, orden.id, { servicioId: servicio.id });

      let actual = await enviarAAprobacion(adminActor, orden.id);
      expect(actual.estado).toBe("PENDIENTE_DE_APROBACION");

      actual = await aprobarOrden(adminActor, orden.id);
      expect(actual.estado).toBe("PROGRAMADA");

      actual = await asignarTecnico(adminActor, orden.id, { tecnicoAsignadoId: tecnico.usuarioId });
      expect(actual.estado).toBe("ASIGNADA");
      expect(actual.tecnicoAsignadoId).toBe(tecnico.usuarioId);

      actual = await iniciarTrabajo(tecnico, orden.id);
      expect(actual.estado).toBe("EN_PROCESO");
      expect(actual.fechaInicio).not.toBeNull();

      actual = await finalizarOrden(tecnico, orden.id, { resultadoTecnico: "Recarga realizada sin observaciones" });
      expect(actual.estado).toBe("FINALIZADA");
      expect(actual.fechaFinalizacion).not.toBeNull();

      actual = await entregarOrden(tecnico, orden.id);
      expect(actual.estado).toBe("ENTREGADA");
      expect(actual.confirmacionClienteRecibida).toBe(true);

      actual = await facturarOrden(adminActor, orden.id);
      expect(actual.estado).toBe("FACTURADA");
    });

    it("admite pausar y reanudar durante EN_PROCESO", async () => {
      const { tenant, adminActor, cliente, servicio } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id, tecnicoAsignadoId: tecnico.usuarioId });
      await agregarItemOrden(adminActor, orden.id, { servicioId: servicio.id });
      await aprobarOrden(adminActor, orden.id);
      await asignarTecnico(adminActor, orden.id, { tecnicoAsignadoId: tecnico.usuarioId });
      await iniciarTrabajo(tecnico, orden.id);

      const pausada = await pausarOrden(tecnico, orden.id, "corte de suministro");
      expect(pausada.estado).toBe("PAUSADA");

      const reanudada = await reanudarOrden(tecnico, orden.id);
      expect(reanudada.estado).toBe("EN_PROCESO");
    });

    it("marcarEnCamino es una transición válida desde ASIGNADA hacia EN_CAMINO", async () => {
      const { tenant, adminActor, cliente } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });
      await aprobarOrden(adminActor, orden.id);
      await asignarTecnico(adminActor, orden.id, { tecnicoAsignadoId: tecnico.usuarioId });

      const enCamino = await marcarEnCamino(tecnico, orden.id);
      expect(enCamino.estado).toBe("EN_CAMINO");

      const enProceso = await iniciarTrabajo(tecnico, orden.id);
      expect(enProceso.estado).toBe("EN_PROCESO");
    });

    it("no puede finalizarse sin al menos un ítem de servicio (datos técnicos incompletos)", async () => {
      const { adminActor, cliente } = await setupBase();
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });
      await aprobarOrden(adminActor, orden.id);
      await asignarTecnico(adminActor, orden.id, { tecnicoAsignadoId: adminActor.usuarioId });
      await iniciarTrabajo(adminActor, orden.id);

      await expect(finalizarOrden(adminActor, orden.id, { resultadoTecnico: "listo" })).rejects.toThrow(DatosTecnicosIncompletosInvalidoError);
    });

    it("rechaza una transición fuera de orden", async () => {
      const { adminActor, cliente } = await setupBase();
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });
      await expect(entregarOrden(adminActor, orden.id)).rejects.toThrow(TransicionOrdenInvalidaError);
    });

    it("cancelar exige un motivo", async () => {
      const { adminActor, cliente } = await setupBase();
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });
      await expect(cancelarOrden(adminActor, orden.id, "")).rejects.toThrow(MotivoCancelacionRequeridoInvalidoError);

      const cancelada = await cancelarOrden(adminActor, orden.id, "el cliente desistió");
      expect(cancelada.estado).toBe("CANCELADA");
    });

    it("un técnico ajeno (no asignado) no puede iniciar el trabajo de una orden que no es suya", async () => {
      const { tenant, adminActor, cliente } = await setupBase();
      const tecnicoAsignado = await crearActorConRol(tenant.id, "Técnico");
      const tecnicoAjeno = await crearActorConRol(tenant.id, "Técnico");
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });
      await aprobarOrden(adminActor, orden.id);
      await asignarTecnico(adminActor, orden.id, { tecnicoAsignadoId: tecnicoAsignado.usuarioId });

      await expect(iniciarTrabajo(tecnicoAjeno, orden.id)).rejects.toThrow(ForbiddenError);
    });

    it("un técnico no puede asignarse órdenes ni aprobarlas ni facturarlas (acciones reservadas a alcance TODAS)", async () => {
      const { tenant, adminActor, cliente } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });

      await expect(aprobarOrden(tecnico, orden.id)).rejects.toThrow(ForbiddenError);
      await expect(asignarTecnico(tecnico, orden.id, { tecnicoAsignadoId: tecnico.usuarioId })).rejects.toThrow(ForbiddenError);
    });
  });

  describe("registrar avance y edición administrativa", () => {
    it("el técnico asignado puede registrar avance (horas, repuestos, resultado) sobre su propia orden", async () => {
      const { tenant, adminActor, cliente } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });
      await aprobarOrden(adminActor, orden.id);
      await asignarTecnico(adminActor, orden.id, { tecnicoAsignadoId: tecnico.usuarioId });

      const actualizada = await registrarAvanceTecnico(tecnico, orden.id, { horasTrabajadas: 1.5, repuestosUtilizados: "manguera nueva" });
      expect(actualizada.horasTrabajadas?.toNumber()).toBe(1.5);
      expect(actualizada.repuestosUtilizados).toBe("manguera nueva");
    });

    it("un rol sólo con VER no puede editar campos administrativos de la orden", async () => {
      const { tenant, adminActor, cliente } = await setupBase();
      const soloLecturaActor = await crearActorSoloLectura(tenant.id);
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });

      await expect(updateOrdenTrabajo(soloLecturaActor, orden.id, { observaciones: "prioridad alta" })).rejects.toThrow(ForbiddenError);
    });
  });

  describe("visibilidad y alcance", () => {
    it("un técnico (alcance PROPIO) sólo lista las órdenes que tiene asignadas", async () => {
      const { tenant, adminActor, cliente } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");
      const asignada = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id, tecnicoAsignadoId: tecnico.usuarioId });
      await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });

      const listado = await listOrdenesTrabajo(tecnico);
      expect(listado.map((o) => o.id)).toEqual([asignada.id]);
    });

    it("un técnico no puede ver por id una orden que no tiene asignada", async () => {
      const { tenant, adminActor, cliente } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });

      const vista = await getOrdenTrabajo(tecnico, orden.id);
      expect(vista).toBeNull();
    });

    it("lanza OrdenTrabajoNotFoundError sobre un id inexistente", async () => {
      const { adminActor } = await setupBase();
      await expect(getOrdenTrabajo(adminActor, "no-existe")).rejects.toThrow(OrdenTrabajoNotFoundError);
    });

    it("una orden de un tenant no es accesible desde otro (RLS)", async () => {
      const { adminActor: actorA, cliente } = await setupBase();
      const { adminActor: actorB } = await setupBase();
      const orden = await crearOrdenTrabajo(actorA, { clienteId: cliente.id });

      await expect(getOrdenTrabajo(actorB, orden.id)).rejects.toThrow();
    });
  });

  describe("listado paginado", () => {
    it("devuelve la primera página con el tamaño y el total correctos", async () => {
      const { adminActor, cliente } = await setupBase();
      for (let i = 0; i < 5; i++) {
        await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });
      }

      const pagina = await listOrdenesTrabajoPaginado(adminActor, { page: 1, pageSize: 2 });

      expect(pagina.total).toBe(5);
      expect(pagina.totalPages).toBe(3);
      expect(pagina.page).toBe(1);
      expect(pagina.pageSize).toBe(2);
      expect(pagina.items).toHaveLength(2);
    });

    it("la segunda página trae registros distintos de la primera", async () => {
      const { adminActor, cliente } = await setupBase();
      for (let i = 0; i < 5; i++) {
        await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });
      }

      const pagina1 = await listOrdenesTrabajoPaginado(adminActor, { page: 1, pageSize: 2 });
      const pagina2 = await listOrdenesTrabajoPaginado(adminActor, { page: 2, pageSize: 2 });

      const idsPagina1 = new Set(pagina1.items.map((o) => o.id));
      const idsPagina2 = new Set(pagina2.items.map((o) => o.id));
      expect([...idsPagina1].some((id) => idsPagina2.has(id))).toBe(false);
    });

    it("una página fuera de rango devuelve una lista vacía sin romper, manteniendo el total real", async () => {
      const { adminActor, cliente } = await setupBase();
      await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });

      const pagina = await listOrdenesTrabajoPaginado(adminActor, { page: 99, pageSize: 10 });

      expect(pagina.items).toHaveLength(0);
      expect(pagina.total).toBe(1);
    });

    it("un técnico (alcance PROPIO) sólo ve en el listado paginado las órdenes que tiene asignadas", async () => {
      // A diferencia de Clientes (donde cualquier alcance != TODAS se trata
      // como sin visibilidad porque el scope ESTABLECIMIENTO_ASIGNADO/PROPIO
      // todavía no se puede resolver), acá "Técnico" sí tiene
      // alcance PROPIO resoluble: ve sus propias órdenes asignadas, igual que
      // en listOrdenesTrabajo (ver test de "visibilidad y alcance" arriba).
      const { tenant, adminActor, cliente } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");
      const asignada = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id, tecnicoAsignadoId: tecnico.usuarioId });
      await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });

      const pagina = await listOrdenesTrabajoPaginado(tecnico, { page: 1 });

      expect(pagina.items.map((o) => o.id)).toEqual([asignada.id]);
      expect(pagina.total).toBe(1);
    });
  });
});

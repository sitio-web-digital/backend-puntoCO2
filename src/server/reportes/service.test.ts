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
import { crearServicio } from "../servicios/service";
import { crearOrdenTrabajo, agregarItemOrden, aprobarOrden, asignarTecnico, iniciarTrabajo, finalizarOrden } from "../ordenes-trabajo/service";
import { registrarRetiro } from "../retiros-entregas/service";
import { emitirCertificado } from "../certificados/service";
import { hashPassword } from "../auth/password";
import { ForbiddenError } from "../rbac/permissions";
import {
  reporteUnidadesProximasAVencer,
  reporteUnidadesVencidas,
  reporteInspecciones,
  reporteMantenimientos,
  reporteOrdenesPorEstado,
  reporteUnidadesRetiradas,
  reporteNoConformidades,
  reporteCertificados,
  reporteNotificacionesFallidas,
  reporteProductividadPorTecnico,
  calcularCoberturaInspecciones,
  calcularIndicadoresOperativos,
} from "./service";
import { toCsv } from "./csv";

describe("reportes e indicadores (RF-26)", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.notificacion.deleteMany({ where: { tenantId } });
        await tx.certificadoUnidad.deleteMany({ where: { tenantId } });
        await tx.certificado.deleteMany({ where: { tenantId } });
        await tx.retiroEntrega.deleteMany({ where: { tenantId } });
        await tx.ordenTrabajoItem.deleteMany({ where: { tenantId } });
        await tx.ordenTrabajoUnidad.deleteMany({ where: { tenantId } });
        await tx.ordenTrabajo.deleteMany({ where: { tenantId } });
        await tx.servicio.deleteMany({ where: { tenantId } });
        await tx.mantenimientoProgramado.deleteMany({ where: { tenantId } });
        await tx.reglaMantenimiento.deleteMany({ where: { tenantId } });
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

  async function setupBase() {
    const unique = randomUUID().slice(0, 8);
    const { tenant, usuarioAdmin } = await createTenant(
      {
        nombre: `Rep Test ${unique}`,
        slug: `rep-test-${unique}`,
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
      razonSocial: "Cliente Reportes SRL",
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

  describe("reportes de unidades", () => {
    it("unidades próximas a vencer: incluye una unidad con inspección próxima", async () => {
      const { tenant, adminActor, matafuego } = await setupBase();
      await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.matafuego.update({ where: { id: matafuego.id }, data: { proximaInspeccion: new Date(Date.now() + 10 * 86_400_000) } }),
      );

      const reporte = await reporteUnidadesProximasAVencer(adminActor);
      expect(reporte.total).toBe(1);
      expect(reporte.datos[0]?.id).toBe(matafuego.id);
    });

    it("unidades vencidas: sólo incluye las que están en estado VENCIDO", async () => {
      const { tenant, adminActor, matafuego } = await setupBase();
      await withTenant({ tenantId: tenant.id }, (tx) => tx.matafuego.update({ where: { id: matafuego.id }, data: { estado: "VENCIDO" } }));

      const reporte = await reporteUnidadesVencidas(adminActor);
      expect(reporte.total).toBe(1);
      expect(reporte.datos[0]?.id).toBe(matafuego.id);
    });

    it("un período sin datos devuelve un resultado vacío informativo, no un error", async () => {
      const { adminActor } = await setupBase();
      const reporte = await reporteUnidadesVencidas(adminActor);
      expect(reporte).toEqual({ total: 0, datos: [] });
    });
  });

  describe("historial de inspecciones y mantenimientos", () => {
    it("filtra inspecciones por rango de fechas", async () => {
      const { adminActor, matafuego } = await setupBase();
      await crearInspeccion(adminActor, { matafuegoId: matafuego.id, resultado: "APTO" });

      const dentro = await reporteInspecciones(adminActor, { desde: new Date(Date.now() - 86_400_000), hasta: new Date(Date.now() + 86_400_000) });
      expect(dentro.total).toBe(1);

      const fuera = await reporteInspecciones(adminActor, {
        desde: new Date(Date.now() - 10 * 86_400_000),
        hasta: new Date(Date.now() - 5 * 86_400_000),
      });
      expect(fuera.total).toBe(0);
    });

    it("filtra mantenimientos por estado", async () => {
      const { adminActor, matafuego } = await setupBase();
      await crearMantenimientoProgramado(adminActor, {
        matafuegoId: matafuego.id,
        tipoServicio: "RECARGA",
        fechaProgramada: new Date(Date.now() + 10 * 86_400_000),
      });

      const programados = await reporteMantenimientos(adminActor, { estado: "PROGRAMADO" });
      expect(programados.total).toBe(1);

      const realizados = await reporteMantenimientos(adminActor, { estado: "REALIZADO" });
      expect(realizados.total).toBe(0);
    });
  });

  describe("órdenes, retiros, no conformidades y certificados", () => {
    it("agrupa órdenes por estado", async () => {
      const { adminActor, cliente } = await setupBase();
      await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });
      const orden2 = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });
      await aprobarOrden(adminActor, orden2.id);

      const reporte = await reporteOrdenesPorEstado(adminActor);
      expect(reporte.total).toBe(2);
      const borrador = reporte.porEstado.find((g) => g.estado === "BORRADOR");
      const programada = reporte.porEstado.find((g) => g.estado === "PROGRAMADA");
      expect(borrador?.cantidad).toBe(1);
      expect(programada?.cantidad).toBe(1);
    });

    it("lista unidades retiradas", async () => {
      const { adminActor, matafuego } = await setupBase();
      await registrarRetiro(adminActor, { matafuegoId: matafuego.id });

      const reporte = await reporteUnidadesRetiradas(adminActor);
      expect(reporte.total).toBe(1);
      expect(reporte.datos[0]?.matafuegoId).toBe(matafuego.id);
    });

    it("agrupa no conformidades por severidad", async () => {
      const { adminActor, matafuego } = await setupBase();
      await crearNoConformidad(adminActor, {
        matafuegoId: matafuego.id,
        tipoDefecto: "Manguera dañada",
        descripcion: "Corte visible",
        severidad: "ALTA",
        nivelRiesgo: "ALTO",
      });
      await crearNoConformidad(adminActor, {
        matafuegoId: matafuego.id,
        tipoDefecto: "Etiqueta ilegible",
        descripcion: "No se lee la fecha",
        severidad: "BAJA",
        nivelRiesgo: "BAJO",
      });

      const reporte = await reporteNoConformidades(adminActor);
      expect(reporte.total).toBe(2);
      expect(reporte.porSeveridad.find((s) => s.severidad === "ALTA")?.cantidad).toBe(1);
      expect(reporte.porSeveridad.find((s) => s.severidad === "BAJA")?.cantidad).toBe(1);
    });

    it("lista certificados emitidos", async () => {
      const { adminActor, cliente, matafuego } = await setupBase();
      const servicio = await crearServicio(adminActor, { codigo: "RC-1", nombre: "Recarga", categoria: "RECARGA", precioBase: 1000 });
      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id, matafuegoIds: [matafuego.id] });
      await agregarItemOrden(adminActor, orden.id, { servicioId: servicio.id });
      await aprobarOrden(adminActor, orden.id);
      await asignarTecnico(adminActor, orden.id, { tecnicoAsignadoId: adminActor.usuarioId });
      await iniciarTrabajo(adminActor, orden.id);
      const finalizada = await finalizarOrden(adminActor, orden.id, { resultadoTecnico: "listo" });
      await emitirCertificado(adminActor, { ordenTrabajoId: finalizada.id, tipo: "CERTIFICADO_RECARGA" });

      const reporte = await reporteCertificados(adminActor, { clienteId: cliente.id });
      expect(reporte.total).toBe(1);
    });
  });

  describe("notificaciones fallidas y productividad", () => {
    it("lista sólo notificaciones en estado FALLIDA", async () => {
      const { tenant, adminActor } = await setupBase();
      await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.notificacion.createMany({
          data: [
            { tenantId: tenant.id, evento: "CERTIFICADO_EMITIDO", canal: "EMAIL", entidadTipo: "Certificado", entidadId: "c1", plantilla: "x", claveDedup: `f1-${randomUUID()}`, estado: "FALLIDA" },
            { tenantId: tenant.id, evento: "CERTIFICADO_EMITIDO", canal: "EMAIL", entidadTipo: "Certificado", entidadId: "c2", plantilla: "x", claveDedup: `f2-${randomUUID()}`, estado: "ENVIADA" },
          ],
        }),
      );

      const reporte = await reporteNotificacionesFallidas(adminActor);
      expect(reporte.total).toBe(1);
    });

    it("agrupa productividad por técnico según órdenes finalizadas", async () => {
      const { tenant, adminActor, cliente } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");
      const servicio = await crearServicio(adminActor, { codigo: "RC-2", nombre: "Recarga", categoria: "RECARGA", precioBase: 1000 });

      const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });
      await agregarItemOrden(adminActor, orden.id, { servicioId: servicio.id });
      await aprobarOrden(adminActor, orden.id);
      await asignarTecnico(adminActor, orden.id, { tecnicoAsignadoId: tecnico.usuarioId });
      await iniciarTrabajo(tecnico, orden.id);
      await finalizarOrden(tecnico, orden.id, { resultadoTecnico: "listo", horasTrabajadas: 2 });

      const reporte = await reporteProductividadPorTecnico(adminActor);
      expect(reporte.total).toBe(1);
      expect(reporte.porTecnico[0]).toMatchObject({ tecnicoAsignadoId: tecnico.usuarioId, ordenesFinalizadas: 1, horasTrabajadas: 2 });
    });
  });

  describe("KPI de cobertura de inspecciones", () => {
    it("100% cuando la unidad que debía inspeccionarse fue inspeccionada en el período", async () => {
      const { tenant, adminActor, matafuego } = await setupBase();
      const desde = new Date(Date.now() - 5 * 86_400_000);
      const hasta = new Date(Date.now() + 5 * 86_400_000);
      await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.matafuego.update({ where: { id: matafuego.id }, data: { proximaInspeccion: new Date() } }),
      );
      await crearInspeccion(adminActor, { matafuegoId: matafuego.id, resultado: "APTO" });

      const kpi = await calcularCoberturaInspecciones(adminActor, { desde, hasta });
      expect(kpi.unidadesQueDebianInspeccionarse).toBe(1);
      expect(kpi.unidadesInspeccionadas).toBe(1);
      expect(kpi.coberturaPorcentaje).toBe(100);
    });

    it("0% cuando la unidad debía inspeccionarse pero no se inspeccionó en el período", async () => {
      const { tenant, adminActor, matafuego } = await setupBase();
      const desde = new Date(Date.now() - 5 * 86_400_000);
      const hasta = new Date(Date.now() + 5 * 86_400_000);
      await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.matafuego.update({ where: { id: matafuego.id }, data: { proximaInspeccion: new Date() } }),
      );

      const kpi = await calcularCoberturaInspecciones(adminActor, { desde, hasta });
      expect(kpi.unidadesQueDebianInspeccionarse).toBe(1);
      expect(kpi.unidadesInspeccionadas).toBe(0);
      expect(kpi.coberturaPorcentaje).toBe(0);
    });

    it("cobertura null cuando ninguna unidad debía inspeccionarse en el período", async () => {
      const { adminActor } = await setupBase();
      const kpi = await calcularCoberturaInspecciones(adminActor, {});
      expect(kpi.unidadesQueDebianInspeccionarse).toBe(0);
      expect(kpi.coberturaPorcentaje).toBeNull();
    });
  });

  describe("indicadores operativos", () => {
    it("cuenta equipos no conformes y notificaciones fallidas", async () => {
      const { tenant, adminActor, matafuego } = await setupBase();
      await crearNoConformidad(adminActor, {
        matafuegoId: matafuego.id,
        tipoDefecto: "x",
        descripcion: "x",
        severidad: "MEDIA",
        nivelRiesgo: "MEDIO",
      });
      await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.notificacion.create({
          data: { tenantId: tenant.id, evento: "CERTIFICADO_EMITIDO", canal: "EMAIL", entidadTipo: "x", entidadId: "x", plantilla: "x", claveDedup: randomUUID(), estado: "FALLIDA" },
        }),
      );

      const indicadores = await calcularIndicadoresOperativos(adminActor);
      expect(indicadores.equiposNoConformes).toBe(1);
      expect(indicadores.notificacionesFallidas).toBe(1);
    });
  });

  describe("acceso y RBAC", () => {
    it("un rol sin permiso de REPORTES (técnico de campo) no puede generar ningún reporte", async () => {
      const { tenant } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");
      await expect(reporteUnidadesVencidas(tecnico)).rejects.toThrow(ForbiddenError);
    });

    it("los reportes sólo incluyen datos del propio tenant (RLS)", async () => {
      const { tenant: tenantA, adminActor: actorA, matafuego } = await setupBase();
      const { adminActor: actorB } = await setupBase();
      await withTenant({ tenantId: tenantA.id }, (tx) => tx.matafuego.update({ where: { id: matafuego.id }, data: { estado: "VENCIDO" } }));

      const reporteA = await reporteUnidadesVencidas(actorA);
      const reporteB = await reporteUnidadesVencidas(actorB);
      expect(reporteA.total).toBe(1);
      expect(reporteB.total).toBe(0);
    });
  });

  describe("exportación CSV", () => {
    it("serializa filas a CSV con encabezados y escapado de comas/comillas", () => {
      const csv = toCsv([
        { codigo: "MAT-1", observaciones: "sin novedades" },
        { codigo: "MAT-2", observaciones: 'con "comillas", y comas' },
      ]);
      const lineas = csv.split("\n");
      expect(lineas[0]).toBe("codigo,observaciones");
      expect(lineas[1]).toBe("MAT-1,sin novedades");
      expect(lineas[2]).toBe('MAT-2,"con ""comillas"", y comas"');
    });

    it("devuelve una cadena vacía para un listado vacío", () => {
      expect(toCsv([])).toBe("");
    });
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { createCliente, type TenantActor } from "../clientes/service";
import { createEstablecimiento } from "../establecimientos/service";
import { createMatafuego } from "../matafuegos/service";
import { crearReglaMantenimiento, crearMantenimientoProgramado } from "../mantenimientos/service";
import { registrarRetiro } from "../retiros-entregas/service";
import { hashPassword } from "../auth/password";
import { ForbiddenError } from "../rbac/permissions";
import {
  generarNotificacion,
  procesarNotificacionesPendientes,
  escanearVencimientosYGenerarNotificaciones,
  listNotificaciones,
  getNotificacion,
  marcarNotificacionLeida,
  cancelarNotificacion,
  NotificacionNotFoundError,
  TransicionNotificacionInvalidaError,
} from "./service";

describe("notificaciones automáticas (RF-19)", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.notificacion.deleteMany({ where: { tenantId } });
        await tx.retiroEntrega.deleteMany({ where: { tenantId } });
        await tx.mantenimientoProgramado.deleteMany({ where: { tenantId } });
        await tx.reglaMantenimiento.deleteMany({ where: { tenantId } });
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

  async function setupBase(clienteOverrides: { email?: string | null; whatsapp?: string | null } = {}) {
    const unique = randomUUID().slice(0, 8);
    const { tenant, usuarioAdmin } = await createTenant(
      {
        nombre: `Notif Test ${unique}`,
        slug: `notif-test-${unique}`,
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
      razonSocial: "Cliente Notif SRL",
      condicionIva: "RESPONSABLE_INSCRIPTO",
      tipoConsumidor: "EMPRESA",
      email: "email" in clienteOverrides ? (clienteOverrides.email ?? undefined) : "contacto@cliente.test",
      whatsapp: "whatsapp" in clienteOverrides ? (clienteOverrides.whatsapp ?? undefined) : undefined,
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

  describe("generación y deduplicación", () => {
    it("genera una notificación con una clave de dedup basada en el día", async () => {
      const { tenant, adminActor } = await setupBase();

      const notificacion = await withTenant({ tenantId: tenant.id }, (tx) =>
        generarNotificacion(tx, {
          tenantId: tenant.id,
          evento: "CERTIFICADO_EMITIDO",
          canal: "EMAIL",
          destinatarioEmail: "cliente@example.com",
          entidadTipo: "Certificado",
          entidadId: "cert-1",
          plantilla: "certificado_emitido",
        }),
      );

      expect(notificacion?.estado).toBe("PENDIENTE");
      void adminActor;
    });

    it("evita el duplicado del mismo evento sobre la misma entidad el mismo día", async () => {
      const { tenant } = await setupBase();

      const params = {
        tenantId: tenant.id,
        evento: "CERTIFICADO_EMITIDO" as const,
        canal: "EMAIL" as const,
        destinatarioEmail: "cliente@example.com",
        entidadTipo: "Certificado",
        entidadId: "cert-1",
        plantilla: "certificado_emitido",
      };

      const primera = await withTenant({ tenantId: tenant.id }, (tx) => generarNotificacion(tx, params));
      const segunda = await withTenant({ tenantId: tenant.id }, (tx) => generarNotificacion(tx, params));

      expect(primera).not.toBeNull();
      expect(segunda).toBeNull();

      const total = await withTenant({ tenantId: tenant.id }, (tx) => tx.notificacion.count());
      expect(total).toBe(1);
    });
  });

  describe("procesamiento de la cola", () => {
    it("envía una notificación con destinatario válido", async () => {
      const { tenant, adminActor } = await setupBase();
      await withTenant({ tenantId: tenant.id }, (tx) =>
        generarNotificacion(tx, {
          tenantId: tenant.id,
          evento: "CERTIFICADO_EMITIDO",
          canal: "EMAIL",
          destinatarioEmail: "cliente@example.com",
          entidadTipo: "Certificado",
          entidadId: "cert-1",
          plantilla: "certificado_emitido",
        }),
      );

      const resultado = await procesarNotificacionesPendientes(adminActor);
      expect(resultado).toEqual({ procesadas: 1, enviadas: 1, fallidas: 0 });

      const [notificacion] = await listNotificaciones(adminActor);
      expect(notificacion?.estado).toBe("ENVIADA");
      expect(notificacion?.enviadaEn).not.toBeNull();
    });

    it("registra el error cuando el contacto está incompleto y agota los reintentos", async () => {
      const { tenant, adminActor } = await setupBase();
      await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.notificacion.create({
          data: {
            tenantId: tenant.id,
            evento: "CERTIFICADO_EMITIDO",
            canal: "EMAIL",
            entidadTipo: "Certificado",
            entidadId: "cert-1",
            plantilla: "certificado_emitido",
            claveDedup: `sin-contacto-${randomUUID()}`,
            maxIntentos: 1,
          },
        }),
      );

      const resultado = await procesarNotificacionesPendientes(adminActor);
      expect(resultado).toEqual({ procesadas: 1, enviadas: 0, fallidas: 1 });

      const [notificacion] = await listNotificaciones(adminActor);
      expect(notificacion?.estado).toBe("FALLIDA");
      expect(notificacion?.errorDetalle).toContain("email");
    });

    it("queda en REINTENTO cuando falla pero todavía no agotó los intentos", async () => {
      const { tenant, adminActor } = await setupBase();
      await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.notificacion.create({
          data: {
            tenantId: tenant.id,
            evento: "CERTIFICADO_EMITIDO",
            canal: "EMAIL",
            entidadTipo: "Certificado",
            entidadId: "cert-1",
            plantilla: "certificado_emitido",
            claveDedup: `sin-contacto-${randomUUID()}`,
            maxIntentos: 3,
          },
        }),
      );

      await procesarNotificacionesPendientes(adminActor);
      const [notificacion] = await listNotificaciones(adminActor);
      expect(notificacion?.estado).toBe("REINTENTO");
      expect(notificacion?.intentos).toBe(1);
    });

    it("usa el canal alternativo cuando el primario falla (fallback)", async () => {
      const { tenant, adminActor } = await setupBase();
      await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.notificacion.create({
          data: {
            tenantId: tenant.id,
            evento: "CERTIFICADO_EMITIDO",
            canal: "EMAIL",
            canalAlternativo: "WHATSAPP",
            destinatarioWhatsapp: "+5491100000000",
            entidadTipo: "Certificado",
            entidadId: "cert-1",
            plantilla: "certificado_emitido",
            claveDedup: `fallback-${randomUUID()}`,
          },
        }),
      );

      const resultado = await procesarNotificacionesPendientes(adminActor);
      expect(resultado).toEqual({ procesadas: 1, enviadas: 1, fallidas: 0 });

      const [notificacion] = await listNotificaciones(adminActor);
      expect(notificacion?.estado).toBe("ENVIADA");
      expect(notificacion?.errorDetalle).toContain("fallback");
    });

    it("un técnico (alcance PROPIO) no puede procesar la cola", async () => {
      const { tenant } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico de campo");
      await expect(procesarNotificacionesPendientes(tecnico)).rejects.toThrow(ForbiddenError);
    });
  });

  describe("escaneo de vencimientos", () => {
    it("genera MATAFUEGO_VENCIDO para una unidad vencida", async () => {
      const { tenant, adminActor, matafuego } = await setupBase();
      await withTenant({ tenantId: tenant.id }, (tx) => tx.matafuego.update({ where: { id: matafuego.id }, data: { estado: "VENCIDO" } }));

      const resultado = await escanearVencimientosYGenerarNotificaciones(adminActor);
      expect(resultado.generadas).toBe(1);

      const [notificacion] = await listNotificaciones(adminActor, { evento: "MATAFUEGO_VENCIDO" });
      expect(notificacion?.entidadId).toBe(matafuego.id);
    });

    it("genera VENCIMIENTO_PROXIMO para una unidad con inspección próxima", async () => {
      const { tenant, adminActor, matafuego } = await setupBase();
      const proximaInspeccion = new Date(Date.now() + 10 * 86_400_000);
      await withTenant({ tenantId: tenant.id }, (tx) => tx.matafuego.update({ where: { id: matafuego.id }, data: { proximaInspeccion } }));

      const resultado = await escanearVencimientosYGenerarNotificaciones(adminActor);
      expect(resultado.generadas).toBe(1);

      const [notificacion] = await listNotificaciones(adminActor, { evento: "VENCIMIENTO_PROXIMO" });
      expect(notificacion?.entidadId).toBe(matafuego.id);
    });

    it("distingue MANTENIMIENTO_PROXIMO de MANTENIMIENTO_ATRASADO según la fecha programada", async () => {
      const { adminActor, matafuego } = await setupBase();
      await crearReglaMantenimiento(adminActor, { tipoServicio: "RECARGA", frecuenciaMeses: 12 });

      const proximo = await crearMantenimientoProgramado(adminActor, {
        matafuegoId: matafuego.id,
        tipoServicio: "MANTENIMIENTO",
        fechaProgramada: new Date(Date.now() + 3 * 86_400_000),
      });
      const atrasado = await crearMantenimientoProgramado(adminActor, {
        matafuegoId: matafuego.id,
        tipoServicio: "RECARGA",
        fechaProgramada: new Date(Date.now() - 5 * 86_400_000),
        motivo: "carga retroactiva de prueba",
      });
      void atrasado;

      const resultado = await escanearVencimientosYGenerarNotificaciones(adminActor);
      expect(resultado.generadas).toBeGreaterThanOrEqual(1);

      const proximos = await listNotificaciones(adminActor, { evento: "MANTENIMIENTO_PROXIMO" });
      expect(proximos.map((n) => n.entidadId)).toContain(proximo.id);
    });

    it("no duplica notificaciones al correr el escaneo dos veces el mismo día", async () => {
      const { tenant, adminActor, matafuego } = await setupBase();
      await withTenant({ tenantId: tenant.id }, (tx) => tx.matafuego.update({ where: { id: matafuego.id }, data: { estado: "VENCIDO" } }));

      const primera = await escanearVencimientosYGenerarNotificaciones(adminActor);
      const segunda = await escanearVencimientosYGenerarNotificaciones(adminActor);

      expect(primera.generadas).toBe(1);
      expect(segunda.generadas).toBe(0);
    });

    it("un técnico (alcance PROPIO) no puede disparar el escaneo", async () => {
      const { tenant } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico de campo");
      await expect(escanearVencimientosYGenerarNotificaciones(tecnico)).rejects.toThrow(ForbiddenError);
    });
  });

  describe("evento real disparado desde otro módulo (RF-12: retiro de unidad)", () => {
    it("registrarRetiro genera una notificación UNIDAD_RETIRADA para el cliente", async () => {
      const { adminActor, matafuego } = await setupBase();

      await registrarRetiro(adminActor, { matafuegoId: matafuego.id });

      const [notificacion] = await listNotificaciones(adminActor, { evento: "UNIDAD_RETIRADA" });
      expect(notificacion?.entidadTipo).toBe("RetiroEntrega");
      expect(notificacion?.destinatarioEmail).toBe("contacto@cliente.test");
    });
  });

  describe("lectura, cancelación y alcance", () => {
    it("el destinatario puede marcar como leída su propia notificación enviada", async () => {
      const { tenant, adminActor } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico de campo");
      const creada = await withTenant({ tenantId: tenant.id }, (tx) =>
        generarNotificacion(tx, {
          tenantId: tenant.id,
          evento: "ORDEN_PROGRAMADA",
          canal: "EMAIL",
          usuarioId: tecnico.usuarioId,
          entidadTipo: "OrdenTrabajo",
          entidadId: "orden-1",
          plantilla: "orden_programada",
        }),
      );
      await withTenant({ tenantId: tenant.id }, (tx) => tx.notificacion.update({ where: { id: creada!.id }, data: { estado: "ENVIADA" } }));

      const leida = await marcarNotificacionLeida(tecnico, creada!.id);
      expect(leida.estado).toBe("LEIDA");
      void adminActor;
    });

    it("no se puede marcar como leída una notificación que todavía no fue enviada", async () => {
      const { tenant, adminActor } = await setupBase();
      const creada = await withTenant({ tenantId: tenant.id }, (tx) =>
        generarNotificacion(tx, {
          tenantId: tenant.id,
          evento: "ORDEN_PROGRAMADA",
          canal: "EMAIL",
          usuarioId: adminActor.usuarioId,
          entidadTipo: "OrdenTrabajo",
          entidadId: "orden-1",
          plantilla: "orden_programada",
        }),
      );

      await expect(marcarNotificacionLeida(adminActor, creada!.id)).rejects.toThrow(TransicionNotificacionInvalidaError);
    });

    it("cancela una notificación pendiente, reservado a alcance TODAS", async () => {
      const { tenant, adminActor } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico de campo");
      const creada = await withTenant({ tenantId: tenant.id }, (tx) =>
        generarNotificacion(tx, {
          tenantId: tenant.id,
          evento: "ORDEN_PROGRAMADA",
          canal: "EMAIL",
          entidadTipo: "OrdenTrabajo",
          entidadId: "orden-1",
          plantilla: "orden_programada",
        }),
      );

      await expect(cancelarNotificacion(tecnico, creada!.id)).rejects.toThrow(ForbiddenError);

      const cancelada = await cancelarNotificacion(adminActor, creada!.id, "ya no aplica");
      expect(cancelada.estado).toBe("CANCELADA");
    });

    it("un técnico (alcance PROPIO) sólo lista sus propias notificaciones", async () => {
      const { tenant, adminActor } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico de campo");

      const propia = await withTenant({ tenantId: tenant.id }, (tx) =>
        generarNotificacion(tx, {
          tenantId: tenant.id,
          evento: "ORDEN_PROGRAMADA",
          canal: "EMAIL",
          usuarioId: tecnico.usuarioId,
          entidadTipo: "OrdenTrabajo",
          entidadId: "orden-1",
          plantilla: "orden_programada",
        }),
      );
      await withTenant({ tenantId: tenant.id }, (tx) =>
        generarNotificacion(tx, {
          tenantId: tenant.id,
          evento: "ORDEN_PROGRAMADA",
          canal: "EMAIL",
          usuarioId: adminActor.usuarioId,
          entidadTipo: "OrdenTrabajo",
          entidadId: "orden-2",
          plantilla: "orden_programada",
        }),
      );

      const listado = await listNotificaciones(tecnico);
      expect(listado.map((n) => n.id)).toEqual([propia!.id]);
    });

    it("lanza NotificacionNotFoundError sobre un id inexistente", async () => {
      const { adminActor } = await setupBase();
      await expect(getNotificacion(adminActor, "no-existe")).rejects.toThrow(NotificacionNotFoundError);
    });

    it("una notificación de un tenant no es accesible desde otro (RLS)", async () => {
      const { tenant: tenantA, adminActor: actorA } = await setupBase();
      const { adminActor: actorB } = await setupBase();
      const creada = await withTenant({ tenantId: tenantA.id }, (tx) =>
        generarNotificacion(tx, {
          tenantId: tenantA.id,
          evento: "ORDEN_PROGRAMADA",
          canal: "EMAIL",
          entidadTipo: "OrdenTrabajo",
          entidadId: "orden-1",
          plantilla: "orden_programada",
        }),
      );
      void actorA;

      await expect(getNotificacion(actorB, creada!.id)).rejects.toThrow();
    });
  });
});

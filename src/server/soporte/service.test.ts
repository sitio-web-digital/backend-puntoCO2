import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { hashPassword } from "../auth/password";
import type { TenantActor } from "../clientes/service";
import type { PlatformActor } from "../platform/service";
import {
  crearTicket,
  listTicketsDeTenantPaginado,
  getTicketDeTenant,
  responderTicket,
  listTicketsPlataforma,
  getTicketPlataforma,
  responderTicketPlataforma,
  cambiarEstadoTicketPlataforma,
  TicketSoporteNotFoundError,
} from "./service";

describe("tickets de soporte", () => {
  const createdTenantIds: string[] = [];
  const createdSuperAdminIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.mensajeTicket.deleteMany({ where: { tenantId } });
        await tx.ticketSoporte.deleteMany({ where: { tenantId } });
        await tx.usuarioRol.deleteMany({ where: { rol: { tenantId } } });
        await tx.usuario.deleteMany({ where: { tenantId } });
        await tx.rolPermiso.deleteMany({ where: { rol: { tenantId } } });
        await tx.rol.deleteMany({ where: { tenantId } });
        await tx.auditLog.deleteMany({ where: { tenantId } });
      });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    createdTenantIds.length = 0;

    if (createdSuperAdminIds.length > 0) {
      await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
        tx.usuario.deleteMany({ where: { id: { in: createdSuperAdminIds } } }),
      );
      createdSuperAdminIds.length = 0;
    }
  });

  /** `MensajeTicket.autorId` es una FK real a `Usuario`, así que un
   * PlatformActor de prueba necesita un usuario superadmin real en la base
   * (a diferencia de AuditLog, que no tiene esa FK). */
  async function crearSuperAdminActor(): Promise<PlatformActor> {
    const unique = randomUUID().slice(0, 8);
    const passwordHash = await hashPassword("clave-de-prueba-segura-123");
    const usuario = await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
      tx.usuario.create({
        data: { tenantId: null, email: `superadmin-${unique}@example.com`, passwordHash, nombre: "Sara", apellido: "SuperAdmin", esSuperAdminSaas: true },
      }),
    );
    createdSuperAdminIds.push(usuario.id);
    return { usuarioId: usuario.id };
  }

  async function setupTenant() {
    const unique = randomUUID().slice(0, 8);
    const { tenant, usuarioAdmin } = await createTenant(
      {
        nombre: `Soporte Test ${unique}`,
        slug: `soporte-test-${unique}`,
        adminEmail: `admin-${unique}@example.com`,
        adminPassword: "clave-de-prueba-segura-123",
        adminNombre: "Ada",
        adminApellido: "Admin",
      },
      { usuarioId: null },
    );
    createdTenantIds.push(tenant.id);
    const adminActor: TenantActor = { tenantId: tenant.id, usuarioId: usuarioAdmin.id };
    return { tenant, adminActor };
  }

  /** Segundo usuario del mismo tenant, sin rol particular: soporte no exige
   * ningún permiso RBAC más allá de estar autenticado como usuario del tenant. */
  async function crearOtroUsuario(tenantId: string) {
    const unique = randomUUID().slice(0, 8);
    const passwordHash = await hashPassword("clave-de-prueba-segura-123");
    const usuario = await withTenant({ tenantId }, (tx) =>
      tx.usuario.create({
        data: { tenantId, email: `empleado-${unique}@example.com`, passwordHash, nombre: "Beto", apellido: "Empleado" },
      }),
    );
    return { tenantId, usuarioId: usuario.id } satisfies TenantActor;
  }

  it("crearTicket crea el ticket ABIERTO con el primer mensaje del creador", async () => {
    const { adminActor } = await setupTenant();

    const ticket = await crearTicket(adminActor, { asunto: "No puedo emitir un certificado", mensaje: "Me tira error 500" });

    expect(ticket.estado).toBe("ABIERTO");
    expect(ticket.prioridad).toBe("NORMAL");
    expect(ticket.mensajes).toHaveLength(1);
    expect(ticket.mensajes[0]?.cuerpo).toBe("Me tira error 500");
    expect(ticket.mensajes[0]?.esSuperAdmin).toBe(false);
  });

  it("listTicketsDeTenantPaginado trae los tickets del tenant paginados", async () => {
    const { adminActor } = await setupTenant();
    await crearTicket(adminActor, { asunto: "Ticket 1", mensaje: "mensaje 1" });
    await crearTicket(adminActor, { asunto: "Ticket 2", mensaje: "mensaje 2" });

    const pagina = await listTicketsDeTenantPaginado(adminActor, { pageSize: 10 });

    expect(pagina.total).toBe(2);
    expect(pagina.items.map((t) => t.asunto).sort()).toEqual(["Ticket 1", "Ticket 2"]);
  });

  it("visibilidad compartida: cualquier empleado del tenant ve y responde los tickets de la empresa", async () => {
    const { tenant, adminActor } = await setupTenant();
    const otroActor = await crearOtroUsuario(tenant.id);

    const ticket = await crearTicket(adminActor, { asunto: "Consulta compartida", mensaje: "mensaje inicial" });

    // El segundo usuario (que no lo creó) puede verlo...
    const visto = await getTicketDeTenant(otroActor, ticket.id);
    expect(visto.id).toBe(ticket.id);

    // ...y responderlo.
    const actualizado = await responderTicket(otroActor, ticket.id, "respondo yo, el otro empleado");
    expect(actualizado.mensajes).toHaveLength(2);
    expect(actualizado.mensajes[1]?.autor.nombre).toBe("Beto");
    expect(actualizado.mensajes[1]).not.toHaveProperty("passwordHash");
  });

  it("aísla tickets entre tenants distintos", async () => {
    const { adminActor: actorA } = await setupTenant();
    const { adminActor: actorB } = await setupTenant();

    const ticketA = await crearTicket(actorA, { asunto: "Ticket de A", mensaje: "solo A" });

    const paginaB = await listTicketsDeTenantPaginado(actorB, { pageSize: 10 });
    expect(paginaB.items.map((t) => t.id)).not.toContain(ticketA.id);

    await expect(getTicketDeTenant(actorB, ticketA.id)).rejects.toThrow(TicketSoporteNotFoundError);
  });

  it("responderTicket reabre un ticket RESUELTO/CERRADO cuando la empresa vuelve a escribir", async () => {
    const { adminActor } = await setupTenant();
    const ticket = await crearTicket(adminActor, { asunto: "Se resuelve y reabre", mensaje: "mensaje inicial" });
    const superAdminActor = await crearSuperAdminActor();

    await cambiarEstadoTicketPlataforma(superAdminActor, ticket.id, "RESUELTO");

    const reabierto = await responderTicket(adminActor, ticket.id, "sigue fallando");
    expect(reabierto.estado).toBe("ABIERTO");
  });

  it("responderTicketPlataforma agrega un mensaje esSuperAdmin y pasa ABIERTO a EN_PROGRESO", async () => {
    const { adminActor } = await setupTenant();
    const ticket = await crearTicket(adminActor, { asunto: "Pide ayuda", mensaje: "no entiendo cómo hacer X" });
    expect(ticket.estado).toBe("ABIERTO");
    const superAdminActor = await crearSuperAdminActor();

    const actualizado = await responderTicketPlataforma(superAdminActor, ticket.id, "Te explico cómo hacerlo...");

    expect(actualizado.estado).toBe("EN_PROGRESO");
    expect(actualizado.mensajes).toHaveLength(2);
    const mensajeSuperAdmin = actualizado.mensajes.find((m) => m.esSuperAdmin);
    expect(mensajeSuperAdmin?.esSuperAdmin).toBe(true);
    expect(mensajeSuperAdmin).not.toHaveProperty("passwordHash");
  });

  it("cambiarEstadoTicketPlataforma cambia el estado directamente", async () => {
    const { adminActor } = await setupTenant();
    const ticket = await crearTicket(adminActor, { asunto: "Se cierra manualmente", mensaje: "mensaje" });
    const superAdminActor = await crearSuperAdminActor();

    const cerrado = await cambiarEstadoTicketPlataforma(superAdminActor, ticket.id, "CERRADO");
    expect(cerrado.estado).toBe("CERRADO");
  });

  it("listTicketsPlataforma trae tickets de todos los tenants con el nombre de la empresa", async () => {
    const { tenant: tenantA, adminActor: actorA } = await setupTenant();
    const { tenant: tenantB, adminActor: actorB } = await setupTenant();
    await crearTicket(actorA, { asunto: "Ticket de A", mensaje: "mensaje" });
    await crearTicket(actorB, { asunto: "Ticket de B", mensaje: "mensaje" });
    const superAdminActor = await crearSuperAdminActor();

    const pagina = await listTicketsPlataforma(superAdminActor, { pageSize: 100 });

    const asuntos = pagina.items.map((t) => t.asunto);
    expect(asuntos).toContain("Ticket de A");
    expect(asuntos).toContain("Ticket de B");
    const encontrado = pagina.items.find((t) => t.asunto === "Ticket de A");
    expect(encontrado?.tenant.nombre).toBe(tenantA.nombre);
    expect(pagina.items.find((t) => t.asunto === "Ticket de B")?.tenant.nombre).toBe(tenantB.nombre);
  });

  it("getTicketPlataforma trae el ticket con tenant y mensajes con autor, sin exponer el hash", async () => {
    const { adminActor } = await setupTenant();
    const ticket = await crearTicket(adminActor, { asunto: "Detalle plataforma", mensaje: "mensaje inicial" });
    const superAdminActor = await crearSuperAdminActor();

    const detalle = await getTicketPlataforma(superAdminActor, ticket.id);

    expect(detalle.mensajes).toHaveLength(1);
    expect(detalle.mensajes[0]?.autor.nombre).toBe("Ada");
    expect(detalle.mensajes[0]).not.toHaveProperty("passwordHash");
    expect(detalle.tenant).not.toHaveProperty("passwordHash");
  });

  it("lanza TicketSoporteNotFoundError sobre un id inexistente en plataforma", async () => {
    const superAdminActor = await crearSuperAdminActor();
    await expect(getTicketPlataforma(superAdminActor, "no-existe")).rejects.toThrow(TicketSoporteNotFoundError);
  });

  // Regresión: la fila de Usuario del superadmin (tenantId null) queda oculta
  // por RLS para una consulta en contexto de tenant (sin bypassRls). Como
  // `MensajeTicket.autor` es una relación obligatoria, un `include` relacional
  // ingenuo hacía que Prisma tirara una excepción ("Field autor is required...")
  // en cuanto la empresa leía un ticket que el superadmin había respondido —
  // rompía con 500 la página `/soporte/[id]` del lado empresa.
  it("la empresa puede leer y responder un ticket después de que el superadmin respondió, sin romper", async () => {
    const { adminActor } = await setupTenant();
    const ticket = await crearTicket(adminActor, { asunto: "Con respuesta de plataforma", mensaje: "mensaje inicial" });
    const superAdminActor = await crearSuperAdminActor();
    await responderTicketPlataforma(superAdminActor, ticket.id, "Te ayudamos con esto");

    const visto = await getTicketDeTenant(adminActor, ticket.id);
    expect(visto.mensajes).toHaveLength(2);
    const mensajeSuperAdmin = visto.mensajes.find((m) => m.esSuperAdmin);
    expect(mensajeSuperAdmin?.autor.nombre).toBe("Sara");
    expect(mensajeSuperAdmin?.autor.apellido).toBe("SuperAdmin");
    expect(mensajeSuperAdmin).not.toHaveProperty("passwordHash");

    // Y la empresa tiene que poder seguir respondiendo sin que rompa tampoco.
    const actualizado = await responderTicket(adminActor, ticket.id, "gracias, ya lo veo");
    expect(actualizado.mensajes).toHaveLength(3);
  });
});

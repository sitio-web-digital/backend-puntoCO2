import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { createCliente, type TenantActor } from "../clientes/service";
import { createEstablecimiento } from "../establecimientos/service";
import { createMatafuego, darDeBajaMatafuego } from "../matafuegos/service";
import { hashPassword } from "../auth/password";
import { ForbiddenError } from "../rbac/permissions";
import { resolveQrPublico, resolveMatafuegoParaEscaneo, regenerarQrMatafuego, QrNotFoundError } from "./service";

describe("identificación por QR (RF-05)", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.movimientoMatafuego.deleteMany({ where: { tenantId } });
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
        nombre: `QR Test ${unique}`,
        slug: `qr-test-${unique}`,
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
      razonSocial: "Cliente QR SRL",
      condicionIva: "RESPONSABLE_INSCRIPTO",
      tipoConsumidor: "EMPRESA",
    });
    const establecimiento = await createEstablecimiento(adminActor, { clienteId: cliente.id, nombre: "Planta QR" });
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

  /** Rol ad-hoc de sólo lectura (VER:TODAS sobre MATAFUEGOS, sin ningún
   * permiso de escritura) — el catálogo por defecto ya no trae un rol
   * "Auditor". */
  async function crearActorSoloLectura(tenantId: string) {
    const unique = randomUUID().slice(0, 8);
    const passwordHash = await hashPassword("clave-de-prueba-segura-123");
    return withTenant({ tenantId }, async (tx) => {
      const rol = await tx.rol.create({
        data: {
          tenantId,
          nombre: `Solo lectura ${unique}`,
          permisos: { create: { recurso: "MATAFUEGOS", accion: "VER", alcance: "TODAS" } },
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

  it("cada matafuego nace con un qrToken único", async () => {
    const { matafuego } = await setupMatafuego();
    expect(matafuego.qrToken).toBeTruthy();
    expect(matafuego.qrToken.length).toBeGreaterThan(10);
  });

  it("resuelve el QR de una unidad activa mostrando sólo datos no sensibles", async () => {
    const { matafuego } = await setupMatafuego();
    const vista = await resolveQrPublico(matafuego.qrToken);

    expect(vista).toEqual({
      matafuegoId: matafuego.id,
      codigoInterno: matafuego.codigoInterno,
      tipo: "PORTATIL",
      agenteExtintor: "CO2",
      capacidadNominal: null,
      estado: "PENDIENTE_DE_CONTROL",
      fechaUltimaInspeccion: null,
      proximaInspeccion: null,
      fechaUltimoMantenimiento: null,
      proximoMantenimiento: null,
      fechaUltimaRecarga: null,
      proximaRecarga: null,
      fechaUltimaPruebaHidraulica: null,
      proximaPruebaHidraulica: null,
    });

    // No debe filtrarse nada de cliente/establecimiento/tenant en la vista pública.
    const vistaComoJson = JSON.stringify(vista);
    expect(vistaComoJson).not.toContain("cliente");
    expect(vistaComoJson).not.toContain("establecimiento");
    expect(vistaComoJson).not.toContain("tenant");
  });

  it("un QR de una unidad dada de baja informa su estado actual, no oculta la unidad", async () => {
    const { adminActor, matafuego } = await setupMatafuego();
    await darDeBajaMatafuego(adminActor, matafuego.id);

    const vista = await resolveQrPublico(matafuego.qrToken);
    expect(vista.estado).toBe("DADO_DE_BAJA");
  });

  it("un token que no existe da un error genérico (no revela si el tenant existe)", async () => {
    await expect(resolveQrPublico("token-que-no-existe-nunca")).rejects.toThrow(QrNotFoundError);
  });

  describe("escáner in-app (celular ya logueado)", () => {
    it("resuelve el token al matafuegoId cuando pertenece al tenant del actor", async () => {
      const { adminActor, matafuego } = await setupMatafuego();
      await expect(resolveMatafuegoParaEscaneo(adminActor, matafuego.qrToken)).resolves.toEqual({ matafuegoId: matafuego.id });
    });

    it("un token que no existe da QrNotFoundError", async () => {
      const { adminActor } = await setupMatafuego();
      await expect(resolveMatafuegoParaEscaneo(adminActor, "token-que-no-existe-nunca")).rejects.toThrow(QrNotFoundError);
    });

    it("un token de OTRO tenant también da QrNotFoundError (RLS), sin distinguir de 'no existe'", async () => {
      const { matafuego: matafuegoDeB } = await setupMatafuego();
      const { adminActor: actorA } = await setupMatafuego();

      await expect(resolveMatafuegoParaEscaneo(actorA, matafuegoDeB.qrToken)).rejects.toThrow(QrNotFoundError);
    });
  });

  it("regenera el QR: el token viejo deja de resolver, el nuevo sí funciona", async () => {
    const { adminActor, matafuego } = await setupMatafuego();
    const tokenViejo = matafuego.qrToken;

    const actualizado = await regenerarQrMatafuego(adminActor, matafuego.id, "sticker dañado");
    expect(actualizado.qrToken).not.toBe(tokenViejo);

    await expect(resolveQrPublico(tokenViejo)).rejects.toThrow(QrNotFoundError);
    await expect(resolveQrPublico(actualizado.qrToken)).resolves.toMatchObject({ matafuegoId: matafuego.id });
  });

  it("un usuario sin alcance administrativo no puede regenerar el QR", async () => {
    const { tenant, matafuego } = await setupMatafuego();
    const soloLecturaActor = await crearActorSoloLectura(tenant.id);

    await expect(regenerarQrMatafuego(soloLecturaActor, matafuego.id, "intento no autorizado")).rejects.toThrow(ForbiddenError);
  });

  it("registra auditoría al regenerar un QR", async () => {
    const { tenant, adminActor, matafuego } = await setupMatafuego();
    await regenerarQrMatafuego(adminActor, matafuego.id, "sticker perdido");

    const logs = await withTenant({ tenantId: tenant.id }, (tx) =>
      tx.auditLog.findMany({ where: { entidad: "Matafuego", entidadId: matafuego.id, accion: "UPDATE" } }),
    );
    expect(logs.some((l) => l.motivo === "sticker perdido")).toBe(true);
  });
});

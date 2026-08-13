import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import { createCliente, type TenantActor } from "../clientes/service";
import { createEstablecimiento } from "../establecimientos/service";
import { createMatafuego } from "../matafuegos/service";
import { crearServicio } from "../servicios/service";
import {
  crearOrdenTrabajo,
  agregarItemOrden,
  aprobarOrden,
  asignarTecnico,
  iniciarTrabajo,
  finalizarOrden,
} from "../ordenes-trabajo/service";
import { hashPassword } from "../auth/password";
import { ForbiddenError } from "../rbac/permissions";
import {
  emitirCertificado,
  anularCertificado,
  reemplazarCertificado,
  listCertificados,
  listCertificadosPaginado,
  getCertificado,
  resolverCertificadoPublico,
  estaVigente,
  CertificadoNotFoundError,
  CertificadoQrNotFoundError,
  OrdenTrabajoAsociadaNotFoundError,
  OrdenNoFinalizadaInvalidoError,
  TransicionCertificadoInvalidaError,
  MotivoAnulacionRequeridoInvalidoError,
} from "./service";

describe("certificados y documentación técnica (RF-17)", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.notificacion.deleteMany({ where: { tenantId } });
        await tx.certificadoUnidad.deleteMany({ where: { tenantId } });
        await tx.certificado.deleteMany({ where: { tenantId } });
        await tx.ordenTrabajoItem.deleteMany({ where: { tenantId } });
        await tx.ordenTrabajoUnidad.deleteMany({ where: { tenantId } });
        await tx.ordenTrabajo.deleteMany({ where: { tenantId } });
        await tx.servicio.deleteMany({ where: { tenantId } });
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

  /** Rol ad-hoc de sólo lectura (VER:TODAS sobre CERTIFICADOS, sin ningún
   * permiso de escritura) — el catálogo por defecto ya no trae un rol
   * "Comercial" con esta combinación exacta de permisos. */
  async function crearActorSoloLectura(tenantId: string) {
    const unique = randomUUID().slice(0, 8);
    const passwordHash = await hashPassword("clave-de-prueba-segura-123");
    return withTenant({ tenantId }, async (tx) => {
      const rol = await tx.rol.create({
        data: {
          tenantId,
          nombre: `Solo lectura ${unique}`,
          permisos: { create: { recurso: "CERTIFICADOS", accion: "VER", alcance: "TODAS" } },
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

  async function setupOrdenFinalizada() {
    const unique = randomUUID().slice(0, 8);
    const { tenant, usuarioAdmin } = await createTenant(
      {
        nombre: `Cert Test ${unique}`,
        slug: `cert-test-${unique}`,
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
      razonSocial: "Cliente Cert SRL",
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
    const servicio = await crearServicio(adminActor, { codigo: `RC-${unique}`, nombre: "Recarga PQS", categoria: "RECARGA", precioBase: 5000 });

    const orden = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id, matafuegoIds: [matafuego.id] });
    await agregarItemOrden(adminActor, orden.id, { servicioId: servicio.id });
    await aprobarOrden(adminActor, orden.id);
    await asignarTecnico(adminActor, orden.id, { tecnicoAsignadoId: adminActor.usuarioId });
    await iniciarTrabajo(adminActor, orden.id);
    const finalizada = await finalizarOrden(adminActor, orden.id, { resultadoTecnico: "Recarga realizada" });

    return { tenant, adminActor, cliente, establecimiento, matafuego, ordenId: finalizada.id };
  }

  describe("emisión", () => {
    it("emite un certificado asociado a la orden y copia sus unidades y servicios", async () => {
      const { adminActor, ordenId, matafuego } = await setupOrdenFinalizada();

      const certificado = await emitirCertificado(adminActor, { ordenTrabajoId: ordenId, tipo: "CERTIFICADO_RECARGA" });

      expect(certificado.estado).toBe("EMITIDO");
      expect(certificado.ordenTrabajoId).toBe(ordenId);
      expect(certificado.serviciosRealizados).toEqual(["Recarga PQS"]);
      expect(certificado.unidades.map((u) => u.matafuegoId)).toEqual([matafuego.id]);
      expect(certificado.qrToken).toBeTruthy();
    });

    it("asigna numeración correlativa por tenant", async () => {
      const { adminActor, ordenId } = await setupOrdenFinalizada();

      const c1 = await emitirCertificado(adminActor, { ordenTrabajoId: ordenId, tipo: "CERTIFICADO_RECARGA" });
      const c2 = await emitirCertificado(adminActor, { ordenTrabajoId: ordenId, tipo: "ACTA_ENTREGA" });

      expect(c2.numero).toBe(c1.numero + 1);
    });

    it("rechaza emitir sobre una orden que no está finalizada/entregada/facturada", async () => {
      const { adminActor, cliente } = await setupOrdenFinalizada();
      const ordenBorrador = await crearOrdenTrabajo(adminActor, { clienteId: cliente.id });

      await expect(emitirCertificado(adminActor, { ordenTrabajoId: ordenBorrador.id, tipo: "CERTIFICADO_RECARGA" })).rejects.toThrow(
        OrdenNoFinalizadaInvalidoError,
      );
    });

    it("rechaza una orden inexistente", async () => {
      const { adminActor } = await setupOrdenFinalizada();
      await expect(emitirCertificado(adminActor, { ordenTrabajoId: "no-existe", tipo: "CERTIFICADO_RECARGA" })).rejects.toThrow(
        OrdenTrabajoAsociadaNotFoundError,
      );
    });

    it("un rol sin EMITIR (sólo VER) no puede emitir certificados", async () => {
      const { tenant, ordenId } = await setupOrdenFinalizada();
      const soloLecturaActor = await crearActorSoloLectura(tenant.id);

      await expect(emitirCertificado(soloLecturaActor, { ordenTrabajoId: ordenId, tipo: "CERTIFICADO_RECARGA" })).rejects.toThrow(ForbiddenError);
    });
  });

  describe("anulación y reemplazo (versionado, nunca se edita en el lugar)", () => {
    it("anula un certificado emitido, exigiendo motivo", async () => {
      const { adminActor, ordenId } = await setupOrdenFinalizada();
      const certificado = await emitirCertificado(adminActor, { ordenTrabajoId: ordenId, tipo: "CERTIFICADO_RECARGA" });

      await expect(anularCertificado(adminActor, certificado.id, "")).rejects.toThrow(MotivoAnulacionRequeridoInvalidoError);

      const anulado = await anularCertificado(adminActor, certificado.id, "error en los datos del cliente");
      expect(anulado.estado).toBe("ANULADO");
    });

    it("no se puede anular un certificado que ya está anulado", async () => {
      const { adminActor, ordenId } = await setupOrdenFinalizada();
      const certificado = await emitirCertificado(adminActor, { ordenTrabajoId: ordenId, tipo: "CERTIFICADO_RECARGA" });
      await anularCertificado(adminActor, certificado.id, "motivo");

      await expect(anularCertificado(adminActor, certificado.id, "otro motivo")).rejects.toThrow(TransicionCertificadoInvalidaError);
    });

    it("reemplaza un certificado: el anterior queda REEMPLAZADO y el nuevo hereda datos con version+1", async () => {
      const { adminActor, ordenId, matafuego } = await setupOrdenFinalizada();
      const original = await emitirCertificado(adminActor, {
        ordenTrabajoId: ordenId,
        tipo: "CERTIFICADO_RECARGA",
        responsableTecnicoNombre: "Juan Pérez",
      });

      const { anterior, nuevo } = await reemplazarCertificado(adminActor, original.id, {
        motivo: "se corrigió la fecha de vigencia",
        vigenciaHasta: new Date(Date.now() + 365 * 86_400_000),
      });

      expect(anterior.estado).toBe("REEMPLAZADO");
      expect(nuevo.estado).toBe("EMITIDO");
      expect(nuevo.version).toBe(original.version + 1);
      expect(nuevo.reemplazaAId).toBe(original.id);
      expect(nuevo.responsableTecnicoNombre).toBe("Juan Pérez");
      expect(nuevo.numero).not.toBe(original.numero);
      expect(nuevo.unidades.map((u) => u.matafuegoId)).toEqual([matafuego.id]);
    });

    it("no se puede reemplazar un certificado ya reemplazado", async () => {
      const { adminActor, ordenId } = await setupOrdenFinalizada();
      const original = await emitirCertificado(adminActor, { ordenTrabajoId: ordenId, tipo: "CERTIFICADO_RECARGA" });
      await reemplazarCertificado(adminActor, original.id, { motivo: "corrección" });

      await expect(reemplazarCertificado(adminActor, original.id, { motivo: "otra corrección" })).rejects.toThrow(
        TransicionCertificadoInvalidaError,
      );
    });
  });

  describe("verificación pública por QR", () => {
    it("informa el estado incluso si el certificado está anulado", async () => {
      const { adminActor, ordenId } = await setupOrdenFinalizada();
      const certificado = await emitirCertificado(adminActor, { ordenTrabajoId: ordenId, tipo: "CERTIFICADO_RECARGA" });
      await anularCertificado(adminActor, certificado.id, "motivo");

      const vista = await resolverCertificadoPublico(certificado.qrToken);
      expect(vista.estado).toBe("ANULADO");
      expect(vista.vigente).toBe(false);
    });

    it("un certificado emitido sin vencimiento está vigente", async () => {
      const { adminActor, ordenId } = await setupOrdenFinalizada();
      const certificado = await emitirCertificado(adminActor, { ordenTrabajoId: ordenId, tipo: "CERTIFICADO_RECARGA" });

      const vista = await resolverCertificadoPublico(certificado.qrToken);
      expect(vista.vigente).toBe(true);
    });

    it("un certificado con vigenciaHasta pasada no está vigente", async () => {
      const { adminActor, ordenId } = await setupOrdenFinalizada();
      const certificado = await emitirCertificado(adminActor, {
        ordenTrabajoId: ordenId,
        tipo: "CERTIFICADO_RECARGA",
        vigenciaHasta: new Date(Date.now() - 86_400_000),
      });

      expect(estaVigente(certificado)).toBe(false);
      const vista = await resolverCertificadoPublico(certificado.qrToken);
      expect(vista.vigente).toBe(false);
    });

    it("lanza CertificadoQrNotFoundError sobre un token inexistente", async () => {
      await expect(resolverCertificadoPublico("token-que-no-existe")).rejects.toThrow(CertificadoQrNotFoundError);
    });
  });

  describe("visibilidad y alcance", () => {
    it("un técnico (alcance PROPIO) sólo lista los certificados donde figura como responsable", async () => {
      const { tenant, adminActor, ordenId } = await setupOrdenFinalizada();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");

      const propio = await emitirCertificado(adminActor, {
        ordenTrabajoId: ordenId,
        tipo: "CERTIFICADO_RECARGA",
        responsableTecnicoId: tecnico.usuarioId,
      });
      await emitirCertificado(adminActor, { ordenTrabajoId: ordenId, tipo: "ACTA_ENTREGA" });

      const listado = await listCertificados(tecnico);
      expect(listado.map((c) => c.id)).toEqual([propio.id]);
    });

    it("lanza CertificadoNotFoundError sobre un id inexistente", async () => {
      const { adminActor } = await setupOrdenFinalizada();
      await expect(getCertificado(adminActor, "no-existe")).rejects.toThrow(CertificadoNotFoundError);
    });

    it("un certificado de un tenant no es accesible desde otro (RLS)", async () => {
      const { adminActor: actorA, ordenId } = await setupOrdenFinalizada();
      const { adminActor: actorB } = await setupOrdenFinalizada();
      const certificado = await emitirCertificado(actorA, { ordenTrabajoId: ordenId, tipo: "CERTIFICADO_RECARGA" });

      await expect(getCertificado(actorB, certificado.id)).rejects.toThrow();
    });
  });

  describe("listado paginado", () => {
    it("devuelve la primera página con el tamaño y el total correctos", async () => {
      const { adminActor, ordenId } = await setupOrdenFinalizada();
      for (let i = 0; i < 5; i++) {
        await emitirCertificado(adminActor, { ordenTrabajoId: ordenId, tipo: "CERTIFICADO_RECARGA" });
      }

      const pagina = await listCertificadosPaginado(adminActor, { page: 1, pageSize: 2 });

      expect(pagina.total).toBe(5);
      expect(pagina.totalPages).toBe(3);
      expect(pagina.page).toBe(1);
      expect(pagina.pageSize).toBe(2);
      expect(pagina.items).toHaveLength(2);
    });

    it("la segunda página trae registros distintos de la primera", async () => {
      const { adminActor, ordenId } = await setupOrdenFinalizada();
      for (let i = 0; i < 5; i++) {
        await emitirCertificado(adminActor, { ordenTrabajoId: ordenId, tipo: "CERTIFICADO_RECARGA" });
      }

      const pagina1 = await listCertificadosPaginado(adminActor, { page: 1, pageSize: 2 });
      const pagina2 = await listCertificadosPaginado(adminActor, { page: 2, pageSize: 2 });

      const idsPagina1 = new Set(pagina1.items.map((c) => c.id));
      const idsPagina2 = new Set(pagina2.items.map((c) => c.id));
      expect([...idsPagina1].some((id) => idsPagina2.has(id))).toBe(false);
    });

    it("una página fuera de rango devuelve una lista vacía sin romper, manteniendo el total real", async () => {
      const { adminActor, ordenId } = await setupOrdenFinalizada();
      await emitirCertificado(adminActor, { ordenTrabajoId: ordenId, tipo: "CERTIFICADO_RECARGA" });

      const pagina = await listCertificadosPaginado(adminActor, { page: 99, pageSize: 10 });

      expect(pagina.items).toHaveLength(0);
      expect(pagina.total).toBe(1);
    });

    it("un técnico (alcance PROPIO) sólo ve sus propios certificados en el listado paginado", async () => {
      // A diferencia de CLIENTES (donde cualquier alcance distinto de TODAS se
      // trata como "sin visibilidad", ver requireScopeTodasOrDeny en
      // clientes/service.ts), CERTIFICADOS sí resuelve el alcance PROPIO: filtra
      // por responsableTecnicoId en vez de devolver la lista vacía.
      const { tenant, adminActor, ordenId } = await setupOrdenFinalizada();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");

      const propio = await emitirCertificado(adminActor, {
        ordenTrabajoId: ordenId,
        tipo: "CERTIFICADO_RECARGA",
        responsableTecnicoId: tecnico.usuarioId,
      });
      await emitirCertificado(adminActor, { ordenTrabajoId: ordenId, tipo: "ACTA_ENTREGA" });

      const pagina = await listCertificadosPaginado(tecnico, { page: 1 });

      expect(pagina.items.map((c) => c.id)).toEqual([propio.id]);
      expect(pagina.total).toBe(1);
    });
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import type { TenantActor } from "../clientes/service";
import { hashPassword } from "../auth/password";
import { ForbiddenError } from "../rbac/permissions";
import {
  crearServicio,
  listServicios,
  getServicio,
  getServicioSeleccionable,
  updateServicio,
  desactivarServicio,
  reactivarServicio,
  crearListaPrecio,
  listListasPrecio,
  fijarPrecio,
  resolverPrecioVigente,
  calcularMargen,
  ServicioNotFoundError,
  CodigoServicioDuplicadoError,
  ServicioNoSeleccionableInvalidoError,
  ListaPrecioNotFoundError,
  NombreListaPrecioDuplicadoError,
} from "./service";

describe("servicios y precios (RF-09)", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
        await tx.precioServicio.deleteMany({ where: { tenantId } });
        await tx.servicio.deleteMany({ where: { tenantId } });
        await tx.listaPrecio.deleteMany({ where: { tenantId } });
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

  async function setupTenant() {
    const unique = randomUUID().slice(0, 8);
    const { tenant, usuarioAdmin } = await createTenant(
      {
        nombre: `Serv Test ${unique}`,
        slug: `serv-test-${unique}`,
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

  describe("catálogo de servicios", () => {
    it("crea un servicio y lo lista", async () => {
      const { adminActor } = await setupTenant();
      await crearServicio(adminActor, { codigo: "RC-01", nombre: "Recarga PQS 5kg", categoria: "RECARGA", precioBase: 5000 });

      const servicios = await listServicios(adminActor);
      expect(servicios).toHaveLength(1);
      expect(servicios[0]?.codigo).toBe("RC-01");
      expect(servicios[0]?.estado).toBe("ACTIVO");
    });

    it("rechaza un código de servicio duplicado dentro del mismo tenant", async () => {
      const { adminActor } = await setupTenant();
      await crearServicio(adminActor, { codigo: "RC-01", nombre: "Recarga PQS 5kg", categoria: "RECARGA", precioBase: 5000 });

      await expect(crearServicio(adminActor, { codigo: "RC-01", nombre: "Otra", categoria: "RECARGA", precioBase: 1000 })).rejects.toThrow(
        CodigoServicioDuplicadoError,
      );
    });

    it("permite el mismo código en tenants distintos", async () => {
      const { adminActor: actorA } = await setupTenant();
      const { adminActor: actorB } = await setupTenant();
      await crearServicio(actorA, { codigo: "RC-01", nombre: "Recarga", categoria: "RECARGA", precioBase: 5000 });

      await expect(crearServicio(actorB, { codigo: "RC-01", nombre: "Recarga", categoria: "RECARGA", precioBase: 4500 })).resolves.toMatchObject({
        codigo: "RC-01",
      });
    });

    it("filtra por categoría y estado", async () => {
      const { adminActor } = await setupTenant();
      await crearServicio(adminActor, { codigo: "RC-01", nombre: "Recarga", categoria: "RECARGA", precioBase: 5000 });
      const pintura = await crearServicio(adminActor, { codigo: "PI-01", nombre: "Pintura", categoria: "PINTURA", precioBase: 3000 });
      await desactivarServicio(adminActor, pintura.id);

      const recargas = await listServicios(adminActor, { categoria: "RECARGA" });
      expect(recargas.map((s) => s.codigo)).toEqual(["RC-01"]);

      const inactivos = await listServicios(adminActor, { estado: "INACTIVO" });
      expect(inactivos.map((s) => s.codigo)).toEqual(["PI-01"]);
    });

    it("calcula el margen a partir de precioBase y costoEstimado, sin guardarlo", async () => {
      const { adminActor } = await setupTenant();
      const servicio = await crearServicio(adminActor, {
        codigo: "RC-01",
        nombre: "Recarga",
        categoria: "RECARGA",
        precioBase: 5000,
        costoEstimado: 3000,
      });

      const margen = calcularMargen(servicio);
      expect(margen.margenAbsoluto).toBe(2000);
      expect(margen.margenPorcentaje).toBe(40);
    });

    it("actualiza un servicio y valida el nuevo código contra duplicados", async () => {
      const { adminActor } = await setupTenant();
      await crearServicio(adminActor, { codigo: "RC-01", nombre: "Recarga", categoria: "RECARGA", precioBase: 5000 });
      const otro = await crearServicio(adminActor, { codigo: "RC-02", nombre: "Recarga grande", categoria: "RECARGA", precioBase: 8000 });

      await expect(updateServicio(adminActor, otro.id, { codigo: "RC-01" })).rejects.toThrow(CodigoServicioDuplicadoError);

      const actualizado = await updateServicio(adminActor, otro.id, { precioBase: 8500 });
      expect(actualizado.precioBase.toNumber()).toBe(8500);
    });

    it("desactiva y reactiva un servicio", async () => {
      const { adminActor } = await setupTenant();
      const servicio = await crearServicio(adminActor, { codigo: "RC-01", nombre: "Recarga", categoria: "RECARGA", precioBase: 5000 });

      const desactivado = await desactivarServicio(adminActor, servicio.id, "descontinuado");
      expect(desactivado.estado).toBe("INACTIVO");

      const reactivado = await reactivarServicio(adminActor, servicio.id);
      expect(reactivado.estado).toBe("ACTIVO");
    });

    it("un servicio desactivado no es seleccionable", async () => {
      const { adminActor } = await setupTenant();
      const servicio = await crearServicio(adminActor, { codigo: "RC-01", nombre: "Recarga", categoria: "RECARGA", precioBase: 5000 });
      await desactivarServicio(adminActor, servicio.id);

      await expect(getServicioSeleccionable(adminActor, servicio.id)).rejects.toThrow(ServicioNoSeleccionableInvalidoError);
    });

    it("lanza ServicioNotFoundError sobre un id inexistente", async () => {
      const { adminActor } = await setupTenant();
      await expect(getServicio(adminActor, "no-existe")).rejects.toThrow(ServicioNotFoundError);
    });

    it("un servicio de un tenant no es accesible desde otro (RLS)", async () => {
      const { adminActor: actorA } = await setupTenant();
      const { adminActor: actorB } = await setupTenant();
      const servicio = await crearServicio(actorA, { codigo: "RC-01", nombre: "Recarga", categoria: "RECARGA", precioBase: 5000 });

      await expect(getServicio(actorB, servicio.id)).rejects.toThrow();
    });

    it("un rol sólo con VER (Comercial) no puede crear servicios", async () => {
      const { tenant, adminActor } = await setupTenant();
      const comercial = await crearActorConRol(tenant.id, "Comercial");

      await expect(crearServicio(comercial, { codigo: "RC-01", nombre: "Recarga", categoria: "RECARGA", precioBase: 5000 })).rejects.toThrow(
        ForbiddenError,
      );

      const servicio = await crearServicio(adminActor, { codigo: "RC-01", nombre: "Recarga", categoria: "RECARGA", precioBase: 5000 });
      const vistos = await listServicios(comercial);
      expect(vistos.map((s) => s.id)).toEqual([servicio.id]);
    });

    it("un técnico de campo puede ver el catálogo (VER:TODAS, necesario para RF-11) pero no puede crearlo ni editarlo", async () => {
      const { tenant, adminActor } = await setupTenant();
      const tecnico = await crearActorConRol(tenant.id, "Técnico de campo");
      const servicio = await crearServicio(adminActor, { codigo: "RC-01", nombre: "Recarga", categoria: "RECARGA", precioBase: 5000 });

      const vistos = await listServicios(tecnico);
      expect(vistos.map((s) => s.id)).toEqual([servicio.id]);

      await expect(crearServicio(tecnico, { codigo: "RC-02", nombre: "Otra", categoria: "RECARGA", precioBase: 1000 })).rejects.toThrow(
        ForbiddenError,
      );
      await expect(updateServicio(tecnico, servicio.id, { precioBase: 9999 })).rejects.toThrow(ForbiddenError);
    });
  });

  describe("listas de precios e historial", () => {
    it("crea una lista de precios y la lista", async () => {
      const { adminActor } = await setupTenant();
      await crearListaPrecio(adminActor, { nombre: "Mayorista" });

      const listas = await listListasPrecio(adminActor);
      expect(listas.map((l) => l.nombre)).toEqual(["Mayorista"]);
    });

    it("rechaza un nombre de lista duplicado dentro del mismo tenant", async () => {
      const { adminActor } = await setupTenant();
      await crearListaPrecio(adminActor, { nombre: "Mayorista" });

      await expect(crearListaPrecio(adminActor, { nombre: "Mayorista" })).rejects.toThrow(NombreListaPrecioDuplicadoError);
    });

    it("resuelve el precio base cuando no hay lista asignada", async () => {
      const { adminActor } = await setupTenant();
      const servicio = await crearServicio(adminActor, { codigo: "RC-01", nombre: "Recarga", categoria: "RECARGA", precioBase: 5000 });

      const resuelto = await resolverPrecioVigente(adminActor, servicio.id);
      expect(resuelto).toMatchObject({ precio: 5000, fuente: "base" });
    });

    it("resuelve el precio base cuando la lista no tiene precio fijado para ese servicio", async () => {
      const { adminActor } = await setupTenant();
      const servicio = await crearServicio(adminActor, { codigo: "RC-01", nombre: "Recarga", categoria: "RECARGA", precioBase: 5000 });
      const lista = await crearListaPrecio(adminActor, { nombre: "Mayorista" });

      const resuelto = await resolverPrecioVigente(adminActor, servicio.id, lista.id);
      expect(resuelto).toMatchObject({ precio: 5000, fuente: "base" });
    });

    it("fija un precio en una lista y lo usa por sobre el precio base", async () => {
      const { adminActor } = await setupTenant();
      const servicio = await crearServicio(adminActor, { codigo: "RC-01", nombre: "Recarga", categoria: "RECARGA", precioBase: 5000 });
      const lista = await crearListaPrecio(adminActor, { nombre: "Mayorista" });

      await fijarPrecio(adminActor, lista.id, servicio.id, { precio: 4200 });

      const resuelto = await resolverPrecioVigente(adminActor, servicio.id, lista.id);
      expect(resuelto).toMatchObject({ precio: 4200, fuente: "lista" });
    });

    it("fijar un nuevo precio cierra el anterior en vez de sobreescribirlo (historial)", async () => {
      const { tenant, adminActor } = await setupTenant();
      const servicio = await crearServicio(adminActor, { codigo: "RC-01", nombre: "Recarga", categoria: "RECARGA", precioBase: 5000 });
      const lista = await crearListaPrecio(adminActor, { nombre: "Mayorista" });

      const primero = await fijarPrecio(adminActor, lista.id, servicio.id, { precio: 4200 });
      const segundo = await fijarPrecio(adminActor, lista.id, servicio.id, { precio: 4500 });

      const historial = await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.precioServicio.findMany({ where: { listaPrecioId: lista.id, servicioId: servicio.id }, orderBy: { createdAt: "asc" } }),
      );
      expect(historial).toHaveLength(2);
      expect(historial[0]?.id).toBe(primero.id);
      expect(historial[0]?.vigenteHasta).not.toBeNull();
      expect(historial[1]?.id).toBe(segundo.id);
      expect(historial[1]?.vigenteHasta).toBeNull();

      const resuelto = await resolverPrecioVigente(adminActor, servicio.id, lista.id);
      expect(resuelto.precio).toBe(4500);
    });

    it("rechaza fijar un precio para una lista o servicio inexistente", async () => {
      const { adminActor } = await setupTenant();
      const servicio = await crearServicio(adminActor, { codigo: "RC-01", nombre: "Recarga", categoria: "RECARGA", precioBase: 5000 });
      const lista = await crearListaPrecio(adminActor, { nombre: "Mayorista" });

      await expect(fijarPrecio(adminActor, "no-existe", servicio.id, { precio: 100 })).rejects.toThrow(ListaPrecioNotFoundError);
      await expect(fijarPrecio(adminActor, lista.id, "no-existe", { precio: 100 })).rejects.toThrow(ServicioNotFoundError);
    });
  });
});

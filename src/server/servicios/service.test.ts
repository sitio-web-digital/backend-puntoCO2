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
  listServiciosPaginado,
  getServicio,
  getServicioSeleccionable,
  updateServicio,
  desactivarServicio,
  reactivarServicio,
  crearListaPrecio,
  listListasPrecio,
  listListasPrecioPaginado,
  getListaPrecio,
  updateListaPrecio,
  desactivarListaPrecio,
  reactivarListaPrecio,
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
    it("obtiene una lista de precios por id", async () => {
      const { adminActor } = await setupTenant();
      const lista = await crearListaPrecio(adminActor, { nombre: "Mayorista" });

      const obtenida = await getListaPrecio(adminActor, lista.id);
      expect(obtenida?.nombre).toBe("Mayorista");
    });

    it("lanza ListaPrecioNotFoundError sobre un id inexistente", async () => {
      const { adminActor } = await setupTenant();
      await expect(getListaPrecio(adminActor, "no-existe")).rejects.toThrow(ListaPrecioNotFoundError);
    });

    it("actualiza una lista de precios y valida el nuevo nombre contra duplicados", async () => {
      const { adminActor } = await setupTenant();
      await crearListaPrecio(adminActor, { nombre: "Mayorista" });
      const otra = await crearListaPrecio(adminActor, { nombre: "Minorista" });

      await expect(updateListaPrecio(adminActor, otra.id, { nombre: "Mayorista" })).rejects.toThrow(NombreListaPrecioDuplicadoError);

      const actualizada = await updateListaPrecio(adminActor, otra.id, { descripcion: "Lista para clientes chicos" });
      expect(actualizada.descripcion).toBe("Lista para clientes chicos");
    });

    it("desactiva y reactiva una lista de precios", async () => {
      const { adminActor } = await setupTenant();
      const lista = await crearListaPrecio(adminActor, { nombre: "Mayorista" });

      const desactivada = await desactivarListaPrecio(adminActor, lista.id, "fuera de temporada");
      expect(desactivada.estado).toBe("INACTIVA");

      const reactivada = await reactivarListaPrecio(adminActor, lista.id);
      expect(reactivada.estado).toBe("ACTIVA");
    });

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

  describe("listado paginado de servicios", () => {
    it("devuelve la primera página con el tamaño y el total correctos", async () => {
      const { adminActor } = await setupTenant();
      for (let i = 0; i < 5; i++) {
        await crearServicio(adminActor, { codigo: `RC-0${i}`, nombre: `Recarga ${i}`, categoria: "RECARGA", precioBase: 5000 });
      }

      const pagina = await listServiciosPaginado(adminActor, { page: 1, pageSize: 2 });

      expect(pagina.total).toBe(5);
      expect(pagina.totalPages).toBe(3);
      expect(pagina.page).toBe(1);
      expect(pagina.pageSize).toBe(2);
      expect(pagina.items).toHaveLength(2);
    });

    it("la segunda página trae registros distintos de la primera", async () => {
      const { adminActor } = await setupTenant();
      for (let i = 0; i < 5; i++) {
        await crearServicio(adminActor, { codigo: `RC-0${i}`, nombre: `Recarga ${i}`, categoria: "RECARGA", precioBase: 5000 });
      }

      const pagina1 = await listServiciosPaginado(adminActor, { page: 1, pageSize: 2 });
      const pagina2 = await listServiciosPaginado(adminActor, { page: 2, pageSize: 2 });

      const idsPagina1 = new Set(pagina1.items.map((s) => s.id));
      const idsPagina2 = new Set(pagina2.items.map((s) => s.id));
      expect([...idsPagina1].some((id) => idsPagina2.has(id))).toBe(false);
    });

    it("una página fuera de rango devuelve una lista vacía sin romper, manteniendo el total real", async () => {
      const { adminActor } = await setupTenant();
      await crearServicio(adminActor, { codigo: "RC-01", nombre: "Recarga", categoria: "RECARGA", precioBase: 5000 });

      const pagina = await listServiciosPaginado(adminActor, { page: 99, pageSize: 10 });

      expect(pagina.items).toHaveLength(0);
      expect(pagina.total).toBe(1);
    });

    // No se agrega el test de "un rol con alcance distinto de TODAS no ve
    // nada" (como en clientes/service.test.ts): en default-roles.ts todos los
    // roles que tienen SERVICIOS_PRECIOS:VER lo tienen con alcance TODAS
    // (Responsable técnico, Técnico de campo, Operador de taller, Comercial,
    // Facturación, Auditor); los que no lo tienen (ej. Cobranza) lanzarían
    // ForbiddenError en vez de devolver un listado vacío, caso ya cubierto en
    // otros tests de este archivo.
  });

  describe("listado paginado de listas de precios", () => {
    it("devuelve la primera página con el tamaño y el total correctos", async () => {
      const { adminActor } = await setupTenant();
      for (let i = 0; i < 5; i++) {
        await crearListaPrecio(adminActor, { nombre: `Lista ${i}` });
      }

      const pagina = await listListasPrecioPaginado(adminActor, { page: 1, pageSize: 2 });

      expect(pagina.total).toBe(5);
      expect(pagina.totalPages).toBe(3);
      expect(pagina.page).toBe(1);
      expect(pagina.pageSize).toBe(2);
      expect(pagina.items).toHaveLength(2);
    });

    it("la segunda página trae registros distintos de la primera", async () => {
      const { adminActor } = await setupTenant();
      for (let i = 0; i < 5; i++) {
        await crearListaPrecio(adminActor, { nombre: `Lista ${i}` });
      }

      const pagina1 = await listListasPrecioPaginado(adminActor, { page: 1, pageSize: 2 });
      const pagina2 = await listListasPrecioPaginado(adminActor, { page: 2, pageSize: 2 });

      const idsPagina1 = new Set(pagina1.items.map((l) => l.id));
      const idsPagina2 = new Set(pagina2.items.map((l) => l.id));
      expect([...idsPagina1].some((id) => idsPagina2.has(id))).toBe(false);
    });

    it("una página fuera de rango devuelve una lista vacía sin romper, manteniendo el total real", async () => {
      const { adminActor } = await setupTenant();
      await crearListaPrecio(adminActor, { nombre: "Mayorista" });

      const pagina = await listListasPrecioPaginado(adminActor, { page: 99, pageSize: 10 });

      expect(pagina.items).toHaveLength(0);
      expect(pagina.total).toBe(1);
    });

    // Ídem: ningún rol tiene SERVICIOS_PRECIOS:VER con alcance distinto de
    // TODAS, así que no hay forma de escribir el test de "alcance distinto de
    // TODAS no ve nada" sin que en realidad sea un ForbiddenError.
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { createTenant } from "../tenants/provisioning";
import type { TenantActor } from "../clientes/service";
import { hashPassword } from "../auth/password";
import { ForbiddenError } from "../rbac/permissions";
import {
  invitarUsuario,
  actualizarUsuario,
  asignarRoles,
  listUsuarios,
  listUsuariosPaginado,
  getUsuario,
  listRoles,
  UsuarioNotFoundError,
  EmailUsuarioDuplicadoError,
  RolAsociadoInvalidoError,
  UltimoAdministradorInvalidoError,
} from "./service";

describe("gestión de usuarios y roles (RF-27)", () => {
  const createdTenantIds: string[] = [];

  afterEach(async () => {
    for (const tenantId of createdTenantIds) {
      await withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
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
        nombre: `Usuarios Test ${unique}`,
        slug: `usuarios-test-${unique}`,
        adminEmail: `admin-${unique}@example.com`,
        adminPassword: "clave-de-prueba-segura-123",
        adminNombre: "Ada",
        adminApellido: "Admin",
      },
      { usuarioId: null },
    );
    createdTenantIds.push(tenant.id);
    const adminActor: TenantActor = { tenantId: tenant.id, usuarioId: usuarioAdmin.id };
    const roles = await listRoles(adminActor);
    return { tenant, adminActor, roles };
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

  describe("catálogo de roles", () => {
    it("lista los 3 roles por defecto sembrados al crear el tenant", async () => {
      const { roles } = await setupBase();
      expect(roles).toHaveLength(3);
      expect(roles.map((r) => r.nombre)).toContain("Administrador de empresa");
      expect(roles.map((r) => r.nombre)).toContain("Técnico");
    });

    it("un técnico de campo (sin permiso USUARIOS_ROLES) no puede listar roles", async () => {
      const { tenant } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");
      await expect(listRoles(tecnico)).rejects.toThrow(ForbiddenError);
    });
  });

  describe("alta de usuarios", () => {
    it("invita un usuario nuevo con el rol indicado", async () => {
      const { adminActor, roles } = await setupBase();
      const rolTecnico = roles.find((r) => r.nombre === "Técnico")!;

      const usuario = await invitarUsuario(adminActor, {
        email: "nuevo.tecnico@example.com",
        password: "clave-de-prueba-segura-123",
        nombre: "Juan",
        apellido: "Pérez",
        rolIds: [rolTecnico.id],
      });

      expect(usuario.email).toBe("nuevo.tecnico@example.com");
      expect(usuario.roles.map((r) => r.rol.nombre)).toEqual(["Técnico"]);
    });

    // Regresión: el hash de contraseña (argon2) no debe viajar nunca fuera de
    // la capa de auth — ni en la respuesta de alta, ni en los listados. Antes
    // de este fix, `invitarUsuario`/`listUsuarios`/`listUsuariosPaginado`/
    // `getUsuario`/`actualizarUsuario`/`asignarRoles` devolvían el registro de
    // Prisma completo sin omitir `passwordHash`, exponiéndolo en el JSON de
    // las rutas de API correspondientes.
    it("el hash de contraseña nunca viaja en la respuesta de alta ni en los listados", async () => {
      const { adminActor, roles } = await setupBase();
      const rolTecnico = roles.find((r) => r.nombre === "Técnico")!;

      const usuario = await invitarUsuario(adminActor, {
        email: "sin.hash@example.com",
        password: "clave-de-prueba-segura-123",
        nombre: "Sin",
        apellido: "Hash",
        rolIds: [rolTecnico.id],
      });
      expect(usuario).not.toHaveProperty("passwordHash");

      const listado = await listUsuarios(adminActor);
      expect(listado.every((u) => !("passwordHash" in u))).toBe(true);
    });

    it("rechaza un email ya usado en el mismo tenant", async () => {
      const { adminActor, roles } = await setupBase();
      const rolTecnico = roles.find((r) => r.nombre === "Técnico")!;
      await invitarUsuario(adminActor, {
        email: "repetido@example.com",
        password: "clave-de-prueba-segura-123",
        nombre: "Juan",
        apellido: "Pérez",
        rolIds: [rolTecnico.id],
      });

      await expect(
        invitarUsuario(adminActor, {
          email: "repetido@example.com",
          password: "clave-de-prueba-segura-123",
          nombre: "Otro",
          apellido: "Usuario",
          rolIds: [rolTecnico.id],
        }),
      ).rejects.toThrow(EmailUsuarioDuplicadoError);
    });

    it("rechaza un rol que no existe en el tenant", async () => {
      const { adminActor } = await setupBase();
      await expect(
        invitarUsuario(adminActor, {
          email: "x@example.com",
          password: "clave-de-prueba-segura-123",
          nombre: "X",
          apellido: "Y",
          rolIds: ["no-existe"],
        }),
      ).rejects.toThrow(RolAsociadoInvalidoError);
    });

    it("un rol sin permiso (Técnico) no puede invitar usuarios", async () => {
      const { tenant, roles } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");
      const rolTecnico = roles.find((r) => r.nombre === "Técnico")!;

      await expect(
        invitarUsuario(tecnico, {
          email: "otro@example.com",
          password: "clave-de-prueba-segura-123",
          nombre: "X",
          apellido: "Y",
          rolIds: [rolTecnico.id],
        }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("edición y bajas", () => {
    it("actualiza nombre y estado de un usuario", async () => {
      const { adminActor, roles } = await setupBase();
      const rolTecnico = roles.find((r) => r.nombre === "Técnico")!;
      const usuario = await invitarUsuario(adminActor, {
        email: "editar@example.com",
        password: "clave-de-prueba-segura-123",
        nombre: "Juan",
        apellido: "Pérez",
        rolIds: [rolTecnico.id],
      });

      const actualizado = await actualizarUsuario(adminActor, usuario.id, { nombre: "Juan Carlos", estado: "SUSPENDIDO" });
      expect(actualizado.nombre).toBe("Juan Carlos");
      expect(actualizado.estado).toBe("SUSPENDIDO");
    });

    it("no permite suspender al único administrador activo", async () => {
      const { adminActor } = await setupBase();
      await expect(actualizarUsuario(adminActor, adminActor.usuarioId, { estado: "SUSPENDIDO" })).rejects.toThrow(
        UltimoAdministradorInvalidoError,
      );
    });

    it("permite suspender a un administrador si hay otro administrador activo", async () => {
      const { adminActor, roles } = await setupBase();
      const rolAdmin = roles.find((r) => r.nombre === "Administrador de empresa")!;
      const segundoAdmin = await invitarUsuario(adminActor, {
        email: "segundo-admin@example.com",
        password: "clave-de-prueba-segura-123",
        nombre: "Otro",
        apellido: "Admin",
        rolIds: [rolAdmin.id],
      });

      const actualizado = await actualizarUsuario(adminActor, adminActor.usuarioId, { estado: "SUSPENDIDO" });
      expect(actualizado.estado).toBe("SUSPENDIDO");
      void segundoAdmin;
    });

    it("lanza UsuarioNotFoundError sobre un id inexistente", async () => {
      const { adminActor } = await setupBase();
      await expect(getUsuario(adminActor, "no-existe")).rejects.toThrow(UsuarioNotFoundError);
    });
  });

  describe("asignación de roles", () => {
    it("reemplaza el conjunto de roles asignados", async () => {
      const { adminActor, roles } = await setupBase();
      const rolTecnico = roles.find((r) => r.nombre === "Técnico")!;
      const rolAdmin = roles.find((r) => r.nombre === "Administrador de empresa")!;
      const usuario = await invitarUsuario(adminActor, {
        email: "reasignar@example.com",
        password: "clave-de-prueba-segura-123",
        nombre: "Juan",
        apellido: "Pérez",
        rolIds: [rolTecnico.id],
      });

      const actualizado = await asignarRoles(adminActor, usuario.id, { rolIds: [rolAdmin.id] });
      expect(actualizado.roles.map((r) => r.rol.nombre)).toEqual(["Administrador de empresa"]);
    });

    it("no permite quitarle el rol de administrador al único administrador activo", async () => {
      const { adminActor, roles } = await setupBase();
      const rolTecnico = roles.find((r) => r.nombre === "Técnico")!;

      await expect(asignarRoles(adminActor, adminActor.usuarioId, { rolIds: [rolTecnico.id] })).rejects.toThrow(
        UltimoAdministradorInvalidoError,
      );
    });
  });

  describe("visibilidad y alcance", () => {
    it("un técnico de campo no puede listar usuarios", async () => {
      const { tenant } = await setupBase();
      const tecnico = await crearActorConRol(tenant.id, "Técnico");
      await expect(listUsuarios(tecnico)).rejects.toThrow(ForbiddenError);
    });

    it("un usuario de un tenant no es accesible desde otro (RLS)", async () => {
      const { adminActor: actorA } = await setupBase();
      const { adminActor: actorB } = await setupBase();
      await expect(getUsuario(actorB, actorA.usuarioId)).rejects.toThrow();
    });
  });

  describe("listado paginado", () => {
    it("devuelve la primera página con el tamaño y el total correctos", async () => {
      const { adminActor, roles } = await setupBase();
      const rolTecnico = roles.find((r) => r.nombre === "Técnico")!;
      for (let i = 0; i < 5; i++) {
        await invitarUsuario(adminActor, {
          email: `usuario${i}@example.com`,
          password: "clave-de-prueba-segura-123",
          nombre: `Usuario${i}`,
          apellido: "Test",
          rolIds: [rolTecnico.id],
        });
      }

      const pagina = await listUsuariosPaginado(adminActor, { page: 1, pageSize: 2 });

      // setupBase ya crea el usuario Administrador, así que el total incluye
      // los 5 invitados más ese: 6 en total, 3 páginas de 2.
      expect(pagina.total).toBe(6);
      expect(pagina.totalPages).toBe(3);
      expect(pagina.page).toBe(1);
      expect(pagina.pageSize).toBe(2);
      expect(pagina.items).toHaveLength(2);
    });

    it("la segunda página trae registros distintos de la primera", async () => {
      const { adminActor, roles } = await setupBase();
      const rolTecnico = roles.find((r) => r.nombre === "Técnico")!;
      for (let i = 0; i < 5; i++) {
        await invitarUsuario(adminActor, {
          email: `usuario${i}@example.com`,
          password: "clave-de-prueba-segura-123",
          nombre: `Usuario${i}`,
          apellido: "Test",
          rolIds: [rolTecnico.id],
        });
      }

      const pagina1 = await listUsuariosPaginado(adminActor, { page: 1, pageSize: 2 });
      const pagina2 = await listUsuariosPaginado(adminActor, { page: 2, pageSize: 2 });

      const idsPagina1 = new Set(pagina1.items.map((u) => u.id));
      const idsPagina2 = new Set(pagina2.items.map((u) => u.id));
      expect([...idsPagina1].some((id) => idsPagina2.has(id))).toBe(false);
    });

    it("una página fuera de rango devuelve una lista vacía sin romper, manteniendo el total real", async () => {
      const { adminActor } = await setupBase();
      // setupBase ya crea el usuario Administrador: total = 1 sin invitar a nadie más.

      const pagina = await listUsuariosPaginado(adminActor, { page: 99, pageSize: 10 });

      expect(pagina.items).toHaveLength(0);
      expect(pagina.total).toBe(1);
    });

    // No se agrega el test de "un rol con alcance distinto de TODAS no ve nada"
    // (como en clientes/service.test.ts): en default-roles.ts ningún rol tiene
    // USUARIOS_ROLES:VER con alcance distinto de TODAS — sólo "Administrador de
    // empresa" lo tiene. El resto no tiene el permiso en absoluto, por lo que
    // listUsuariosPaginado lanzaría ForbiddenError (vía requirePermission) en
    // vez de devolver un listado vacío, que es un caso ya cubierto por el test
    // existente "un técnico de campo no puede listar usuarios".
  });
});

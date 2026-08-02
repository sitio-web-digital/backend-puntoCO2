import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_TEMPLATES } from "./default-roles";

describe("catálogo de roles por defecto (RF-27)", () => {
  it("define exactamente los 9 roles iniciales tenant-scoped del documento de requisitos", () => {
    const nombres = DEFAULT_ROLE_TEMPLATES.map((r) => r.nombre);
    expect(nombres).toEqual([
      "Administrador de empresa",
      "Responsable técnico",
      "Técnico de campo",
      "Operador de taller",
      "Comercial",
      "Facturación",
      "Cobranza",
      "Auditor",
      "Cliente externo",
    ]);
  });

  it("no incluye al Superadministrador SaaS (es un flag de plataforma, no un rol de tenant)", () => {
    const nombres = DEFAULT_ROLE_TEMPLATES.map((r) => r.nombre);
    expect(nombres).not.toContain("Superadministrador SaaS");
  });

  it("ningún rol de tenant tiene permiso sobre TENANT_ADMIN (reservado a la plataforma)", () => {
    for (const rol of DEFAULT_ROLE_TEMPLATES) {
      const tieneTenantAdmin = rol.permisos.some((p) => p.recurso === "TENANT_ADMIN");
      expect(tieneTenantAdmin, `${rol.nombre} no debería tener permisos TENANT_ADMIN`).toBe(false);
    }
  });

  it("Administrador de empresa tiene control TODAS sobre cada recurso y acción de negocio", () => {
    const admin = DEFAULT_ROLE_TEMPLATES.find((r) => r.nombre === "Administrador de empresa")!;
    const clientesEditar = admin.permisos.find((p) => p.recurso === "CLIENTES" && p.accion === "EDITAR");
    expect(clientesEditar?.alcance).toBe("TODAS");
    const usuariosEliminar = admin.permisos.find((p) => p.recurso === "USUARIOS_ROLES" && p.accion === "ELIMINAR");
    expect(usuariosEliminar?.alcance).toBe("TODAS");
  });

  it("Técnico de campo nunca tiene alcance TODAS para escribir (rol de menor privilegio operativo)", () => {
    const tecnico = DEFAULT_ROLE_TEMPLATES.find((r) => r.nombre === "Técnico de campo")!;
    const escrituraConAlcanceTodas = tecnico.permisos.filter((p) => p.alcance === "TODAS" && p.accion !== "VER");
    expect(escrituraConAlcanceTodas).toEqual([]);
  });

  // Única excepción de lectura: VER:TODAS sobre SERVICIOS_PRECIOS, necesaria
  // para que el técnico pueda ver el catálogo al agregar un ítem a su propia
  // orden asignada (RF-11) — ver comentario junto al grant en
  // DEFAULT_ROLE_TEMPLATES para el detalle.
  it("el único alcance TODAS de Técnico de campo es VER sobre el catálogo de servicios y precios", () => {
    const tecnico = DEFAULT_ROLE_TEMPLATES.find((r) => r.nombre === "Técnico de campo")!;
    const conAlcanceTodas = tecnico.permisos.filter((p) => p.alcance === "TODAS");
    expect(conAlcanceTodas).toEqual([{ recurso: "SERVICIOS_PRECIOS", accion: "VER", alcance: "TODAS" }]);
  });

  it("Auditor sólo tiene permisos de VER o EXPORTAR, nunca de escritura", () => {
    const auditor = DEFAULT_ROLE_TEMPLATES.find((r) => r.nombre === "Auditor")!;
    const accionesDeEscritura = auditor.permisos.filter((p) => !["VER", "EXPORTAR"].includes(p.accion));
    expect(accionesDeEscritura).toEqual([]);
  });

  it("Cliente externo sólo ve/aprueba lo PROPIO, nunca datos de otros clientes", () => {
    const clienteExterno = DEFAULT_ROLE_TEMPLATES.find((r) => r.nombre === "Cliente externo")!;
    for (const permiso of clienteExterno.permisos) {
      expect(permiso.alcance).toBe("PROPIO");
    }
  });

  it("cada rol tiene al menos un permiso concedido (ningún rol vacío)", () => {
    for (const rol of DEFAULT_ROLE_TEMPLATES) {
      expect(rol.permisos.length, `${rol.nombre} no debería tener 0 permisos`).toBeGreaterThan(0);
    }
  });
});

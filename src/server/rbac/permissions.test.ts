import { describe, expect, it } from "vitest";
import { computeEffectivePermissions, getGrantedScope, requirePermission, ForbiddenError, type PermisoConcedido } from "./permissions";

describe("RBAC: cálculo de alcance efectivo", () => {
  it("deniega por defecto un recurso+acción sin permiso concedido", () => {
    const effective = computeEffectivePermissions([]);
    expect(getGrantedScope(effective, "CLIENTES", "EDITAR")).toBe("PROHIBIDO");
  });

  it("concede el alcance definido cuando hay un único permiso", () => {
    const permisos: PermisoConcedido[] = [{ recurso: "CLIENTES", accion: "EDITAR", alcance: "ESTABLECIMIENTO_ASIGNADO" }];
    const effective = computeEffectivePermissions(permisos);
    expect(getGrantedScope(effective, "CLIENTES", "EDITAR")).toBe("ESTABLECIMIENTO_ASIGNADO");
  });

  it("combina permisos de varios roles quedándose con el alcance más amplio", () => {
    const permisos: PermisoConcedido[] = [
      { recurso: "ORDENES_TRABAJO", accion: "EDITAR", alcance: "PROPIO" },
      { recurso: "ORDENES_TRABAJO", accion: "EDITAR", alcance: "TODAS" },
    ];
    const effective = computeEffectivePermissions(permisos);
    expect(getGrantedScope(effective, "ORDENES_TRABAJO", "EDITAR")).toBe("TODAS");
  });

  it("no deja que un alcance más angosto de otro rol reduzca el ya concedido", () => {
    const permisos: PermisoConcedido[] = [
      { recurso: "ORDENES_TRABAJO", accion: "EDITAR", alcance: "TODAS" },
      { recurso: "ORDENES_TRABAJO", accion: "EDITAR", alcance: "PROPIO" },
    ];
    const effective = computeEffectivePermissions(permisos);
    expect(getGrantedScope(effective, "ORDENES_TRABAJO", "EDITAR")).toBe("TODAS");
  });

  it("no confunde acciones distintas del mismo recurso", () => {
    const permisos: PermisoConcedido[] = [{ recurso: "CLIENTES", accion: "VER", alcance: "TODAS" }];
    const effective = computeEffectivePermissions(permisos);
    expect(getGrantedScope(effective, "CLIENTES", "EDITAR")).toBe("PROHIBIDO");
  });
});

describe("RBAC: requirePermission", () => {
  it("devuelve el alcance cuando el usuario tiene permiso", () => {
    const effective = computeEffectivePermissions([{ recurso: "CLIENTES", accion: "VER", alcance: "PROPIO" }]);
    expect(requirePermission(effective, "CLIENTES", "VER")).toBe("PROPIO");
  });

  it("lanza ForbiddenError cuando el usuario no tiene permiso", () => {
    const effective = computeEffectivePermissions([]);
    expect(() => requirePermission(effective, "CLIENTES", "ELIMINAR")).toThrow(ForbiddenError);
  });

  it("lanza ForbiddenError cuando el alcance concedido es explícitamente PROHIBIDO", () => {
    const effective = computeEffectivePermissions([{ recurso: "CLIENTES", accion: "EXPORTAR", alcance: "PROHIBIDO" }]);
    expect(() => requirePermission(effective, "CLIENTES", "EXPORTAR")).toThrow(ForbiddenError);
  });
});

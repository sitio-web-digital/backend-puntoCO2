import type { AccionPermiso, AlcancePermiso, RecursoPermiso } from "@prisma/client";

export class ForbiddenError extends Error {
  constructor(recurso: RecursoPermiso, accion: AccionPermiso) {
    super(`Permiso denegado: ${recurso}:${accion}`);
    this.name = "ForbiddenError";
  }
}

export interface PermisoConcedido {
  recurso: RecursoPermiso;
  accion: AccionPermiso;
  alcance: AlcancePermiso;
}

// Orden de mayor a menor amplitud. Si un usuario tiene el mismo recurso+acción
// concedido por dos roles distintos con alcances distintos, gana el más amplio.
const SCOPE_RANK: Record<AlcancePermiso, number> = {
  PROHIBIDO: 0,
  PROPIO: 1,
  ESTABLECIMIENTO_ASIGNADO: 2,
  SUCURSAL_ACTUAL: 3,
  TODAS: 4,
};

/**
 * Combina los permisos de todos los roles de un usuario en el alcance efectivo
 * por recurso+acción, quedándose con el más amplio quando hay solapamiento.
 */
export function computeEffectivePermissions(permisos: PermisoConcedido[]): Map<string, AlcancePermiso> {
  const effective = new Map<string, AlcancePermiso>();
  for (const p of permisos) {
    const key = `${p.recurso}:${p.accion}`;
    const current = effective.get(key);
    if (!current || SCOPE_RANK[p.alcance] > SCOPE_RANK[current]) {
      effective.set(key, p.alcance);
    }
  }
  return effective;
}

export function getGrantedScope(
  effective: Map<string, AlcancePermiso>,
  recurso: RecursoPermiso,
  accion: AccionPermiso,
): AlcancePermiso {
  return effective.get(`${recurso}:${accion}`) ?? "PROHIBIDO";
}

/**
 * Devuelve el alcance concedido, o lanza ForbiddenError si el usuario no tiene
 * ningún acceso a recurso+acción. El caller (capa de servicio del módulo) es
 * responsable de aplicar el alcance devuelto como filtro adicional en su query
 * (por ejemplo, agregar `where: { establecimientoId: { in: asignados } }`
 * cuando el alcance es ESTABLECIMIENTO_ASIGNADO).
 */
export function requirePermission(
  effective: Map<string, AlcancePermiso>,
  recurso: RecursoPermiso,
  accion: AccionPermiso,
): AlcancePermiso {
  const scope = getGrantedScope(effective, recurso, accion);
  if (scope === "PROHIBIDO") {
    throw new ForbiddenError(recurso, accion);
  }
  return scope;
}

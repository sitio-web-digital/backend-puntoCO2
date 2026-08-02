import type { TenantTx } from "../db/with-tenant";
import { computeEffectivePermissions, type PermisoConcedido } from "./permissions";
import type { AlcancePermiso } from "@prisma/client";

/** Carga los roles del usuario (dentro del tenant activo, vía RLS) y calcula
 * su alcance efectivo por recurso+acción. Debe llamarse dentro de un
 * `withTenant` ya abierto, para que la lectura de Rol/RolPermiso quede
 * scopeada al tenant correcto. */
export async function getEffectivePermissions(tx: TenantTx, usuarioId: string): Promise<Map<string, AlcancePermiso>> {
  const asignaciones = await tx.usuarioRol.findMany({
    where: { usuarioId },
    include: { rol: { include: { permisos: true } } },
  });

  const permisos: PermisoConcedido[] = asignaciones.flatMap((a) =>
    a.rol.permisos.map((p) => ({ recurso: p.recurso, accion: p.accion, alcance: p.alcance })),
  );

  return computeEffectivePermissions(permisos);
}

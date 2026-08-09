import { prisma } from "@/server/db/client";
import { withTenant } from "@/server/db/with-tenant";

export interface OwnProfile {
  nombre: string;
  apellido: string;
  email: string;
  roles: string[];
}

/**
 * Perfil del propio usuario autenticado para mostrar en el shell de la app
 * (sidebar). A diferencia de `getUsuario` en `service.ts`, no exige el
 * permiso USUARIOS_ROLES:VER — cualquier usuario puede ver su propio nombre
 * y roles, independientemente de si tiene permiso para ver a otros.
 */
export async function getOwnProfile(tenantId: string, usuarioId: string): Promise<OwnProfile | null> {
  return withTenant({ tenantId }, async (tx) => {
    const usuario = await tx.usuario.findUnique({
      where: { id: usuarioId },
      include: { roles: { include: { rol: true } } },
    });
    if (!usuario) return null;
    return {
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      roles: usuario.roles.map((r) => r.rol.nombre),
    };
  });
}

/** El slug del tenant se muestra en el sidebar; es la tabla de plataforma, sin RLS por fila. */
export async function getTenantSlug(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
  return tenant?.slug ?? "";
}

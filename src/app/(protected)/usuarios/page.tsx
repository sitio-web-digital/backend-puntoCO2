import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { listUsuariosPaginado, listRoles } from "@/server/usuarios/service";
import type { TenantActor } from "@/server/clientes/service";
import { ForbiddenError } from "@/server/rbac/permissions";
import { EstadoBadge } from "../_lib/estado-badge";
import { NuevoUsuarioForm } from "./NuevoUsuarioForm";
import { RolesUsuarioForm } from "./RolesUsuarioForm";
import { CambiarEstadoUsuario } from "./CambiarEstadoUsuario";
import { EditarUsuarioForm } from "./EditarUsuarioForm";
import { Pagination } from "../_components/Pagination";

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { page: pageParam } = await searchParams;

  let usuariosPagina, roles;
  try {
    [usuariosPagina, roles] = await Promise.all([
      listUsuariosPaginado(actor, { page: pageParam ? Number(pageParam) : 1 }),
      listRoles(actor),
    ]);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return (
        <div className="card stack" style={{ gap: 12, maxWidth: 480, margin: "40px auto" }}>
          <h1 style={{ fontSize: 20 }}>No tenés permiso para ver esta sección</h1>
          <p className="muted" style={{ margin: 0 }}>
            La administración de usuarios es sólo para roles con permiso sobre Usuarios y roles. Si creés que deberías tenerlo, pedile a un
            administrador de tu empresa que revise tus roles.
          </p>
          <Link href="/clientes" className="btn-primary">
            Volver al inicio
          </Link>
        </div>
      );
    }
    throw err;
  }
  const { items: usuarios, total, page, totalPages, pageSize } = usuariosPagina;

  return (
    <div className="stack">
      <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="stack" style={{ gap: 6 }}>
          <h1>Usuarios</h1>
          <p className="muted" style={{ maxWidth: "80ch" }}>
            Alta y gestión de los usuarios de la empresa. Todavía no hay envío de invitación por email: la contraseña inicial se fija acá y
            se comparte directamente con la persona.
          </p>
        </div>
        <NuevoUsuarioForm roles={roles} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        {usuarios.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            Todavía no hay usuarios cargados.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Roles</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>
                        {u.nombre} {u.apellido}
                      </td>
                      <td style={{ color: "var(--text-2)", fontSize: 13 }}>{u.email}</td>
                      <td>
                        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                          {u.roles.map((r) => (
                            <span key={r.id} className="role-badge">
                              {r.rol.nombre}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <EstadoBadge estado={u.estado} />
                      </td>
                      <td>
                        <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <EditarUsuarioForm usuario={{ id: u.id, nombre: u.nombre, apellido: u.apellido }} />
                          <RolesUsuarioForm usuarioId={u.id} roles={roles} rolesActuales={u.roles.map((r) => r.rolId)} />
                          <CambiarEstadoUsuario usuarioId={u.id} estadoActual={u.estado} esPropio={u.id === user.usuarioId} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} basePath="/usuarios" />
          </>
        )}
      </div>
    </div>
  );
}

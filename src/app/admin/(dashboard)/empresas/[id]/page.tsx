import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/server/auth/current-user";
import { getTenantPlataforma, TenantNotFoundError } from "@/server/platform/service";
import { EstadoBadge } from "@/app/(protected)/_lib/estado-badge";
import { ActionButton } from "@/app/(protected)/_components/ActionButton";
import { EditarWhatsappForm } from "./EditarWhatsappForm";

export default async function EmpresaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSuperAdmin();
  const { id } = await params;

  const tenant = await getTenantPlataforma(actor, id).catch((err) => {
    if (err instanceof TenantNotFoundError) return null;
    throw err;
  });
  if (!tenant) notFound();

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 10 }}>
        <Link href="/admin/empresas" className="back-link">
          ← Empresas
        </Link>
        <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            <h1>{tenant.nombre}</h1>
            <EstadoBadge estado={tenant.estado} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="detail-grid">
          <div>
            <label>Identificador</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {tenant.slug}
            </div>
          </div>
          <div>
            <label>CUIT</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {tenant.cuit ?? "—"}
            </div>
          </div>
          <div>
            <label>Alta</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {new Date(tenant.createdAt).toLocaleDateString("es-AR")}
            </div>
          </div>
          <div>
            <label>{tenant.estado === "TRIAL" ? "Prueba vence el" : "Vigencia hasta"}</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {tenant.vigenciaHasta ? new Date(tenant.vigenciaHasta).toLocaleDateString("es-AR") : "—"}
            </div>
          </div>
          <div>
            <label>Usuarios</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {tenant._count.usuarios}
            </div>
          </div>
          <div>
            <label>Clientes cargados</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {tenant._count.clientes}
            </div>
          </div>
          <div>
            <label>Matafuegos</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {tenant._count.matafuegos}
            </div>
          </div>
          <EditarWhatsappForm tenantId={tenant.id} valorActual={tenant.whatsappFromNumber} />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <h2>Usuarios activos</h2>
        </div>
        {tenant.usuarios.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            No hay usuarios activos.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {tenant.usuarios.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>
                      {u.nombre} {u.apellido}
                    </td>
                    <td style={{ color: "var(--text-2)", fontSize: 13 }}>{u.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <h2>Acciones</h2>
        </div>
        <div className="actions-bar" style={{ padding: "12px 16px", flexWrap: "wrap" }}>
          {tenant.estado !== "ACTIVO" ? (
            <ActionButton
              label={tenant.estado === "TRIAL" ? "Activar suscripción" : "Marcar como pagado"}
              url={`/api/platform/tenants/${tenant.id}/marcar-pago`}
              variant="primary"
              confirmar="¿Confirmar el pago y activar esta empresa por otro ciclo (30 días)?"
            />
          ) : null}
          {tenant.estado === "TRIAL" || tenant.estado === "ACTIVO" ? (
            <ActionButton
              label="Suspender empresa"
              url={`/api/platform/tenants/${tenant.id}/suspender`}
              pedirMotivoComo="motivo"
              variant="danger"
              confirmar="¿Suspender esta empresa? Ninguno de sus usuarios va a poder iniciar sesión hasta reactivarla."
            />
          ) : null}
          {tenant.estado !== "CANCELADO" ? (
            <ActionButton
              label="Marcar como cancelada"
              url={`/api/platform/tenants/${tenant.id}/estado`}
              body={{ estado: "CANCELADO" }}
              pedirMotivoComo="motivo"
              variant="danger"
              confirmar="¿Marcar esta empresa como CANCELADA? Sus usuarios no van a poder iniciar sesión."
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

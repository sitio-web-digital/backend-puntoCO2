import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { listNotificacionesPaginado } from "@/server/notificaciones/service";
import type { TenantActor } from "@/server/clientes/service";
import { EstadoBadge, formatFechaHora } from "../_lib/estado-badge";
import { ActionButton } from "../_components/ActionButton";
import { MarcarLeidaButton } from "./MarcarLeidaButton";
import { Pagination } from "../_components/Pagination";

export default async function NotificacionesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { page: pageParam } = await searchParams;
  const { items: notificaciones, total, page, totalPages, pageSize } = await listNotificacionesPaginado(actor, {
    page: pageParam ? Number(pageParam) : 1,
  });

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 6 }}>
        <h1>Notificaciones</h1>
        <p className="muted" style={{ maxWidth: "80ch" }}>
          No hay proveedor de email/WhatsApp real configurado todavía: el envío queda registrado en el log del servidor. Mientras no exista
          un job periódico configurado en el despliegue, el escaneo de vencimientos y el procesamiento de la cola se disparan manualmente
          acá.
        </p>
      </div>

      <div className="card" style={{ padding: "12px 16px" }}>
        <div className="actions-bar">
          <ActionButton label="Procesar cola pendiente" displayLabel="Procesar cola" url="/api/notificaciones/procesar" variant="primary" />
          <ActionButton label="Escanear vencimientos" displayLabel="Escanear" url="/api/notificaciones/escanear-vencimientos" />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {notificaciones.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            No hay notificaciones.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th>Canal</th>
                    <th>Destinatario</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {notificaciones.map((n) => (
                    <tr key={n.id}>
                      <td style={{ fontWeight: 500 }}>{n.evento.replaceAll("_", " ")}</td>
                      <td className="mono" style={{ fontSize: 11.5, letterSpacing: ".05em" }}>
                        {n.canal}
                      </td>
                      <td>{n.destinatarioEmail ?? n.destinatarioWhatsapp ?? n.destinatarioNombre ?? "—"}</td>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>
                        {formatFechaHora(n.createdAt)}
                      </td>
                      <td>
                        <EstadoBadge estado={n.estado} />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {["ENVIADA", "ENTREGADA"].includes(n.estado) ? <MarcarLeidaButton id={n.id} /> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} basePath="/notificaciones" />
          </>
        )}
      </div>
    </div>
  );
}

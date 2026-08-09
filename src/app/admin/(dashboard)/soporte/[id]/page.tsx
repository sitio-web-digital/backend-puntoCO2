import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/server/auth/current-user";
import { getTicketPlataforma, TicketSoporteNotFoundError } from "@/server/soporte/service";
import { EstadoBadge, formatFechaHora } from "@/app/(protected)/_lib/estado-badge";
import { ActionButton } from "@/app/(protected)/_components/ActionButton";
import { ResponderTicketPlataformaForm } from "./ResponderTicketPlataformaForm";

export default async function TicketPlataformaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSuperAdmin();
  const { id } = await params;

  const ticket = await getTicketPlataforma(actor, id).catch((err) => {
    if (err instanceof TicketSoporteNotFoundError) return null;
    throw err;
  });
  if (!ticket) notFound();

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 10 }}>
        <Link href="/admin/soporte" className="back-link">
          ← Soporte
        </Link>
        <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            <h1>{ticket.asunto}</h1>
            <EstadoBadge estado={ticket.estado} />
          </div>
          <span className="muted">
            {ticket.tenant.nombre} ({ticket.tenant.slug}) · Prioridad: {ticket.prioridad}
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <h2>Acciones</h2>
        </div>
        <div className="actions-bar" style={{ padding: "12px 16px" }}>
          {ticket.estado !== "EN_PROGRESO" ? (
            <ActionButton
              label="Marcar en progreso"
              url={`/api/platform/tickets/${ticket.id}/estado`}
              body={{ estado: "EN_PROGRESO" }}
              variant="secondary"
              size="sm"
            />
          ) : null}
          {ticket.estado !== "RESUELTO" ? (
            <ActionButton
              label="Resolver"
              url={`/api/platform/tickets/${ticket.id}/estado`}
              body={{ estado: "RESUELTO" }}
              variant="primary"
              size="sm"
            />
          ) : null}
          {ticket.estado !== "CERRADO" ? (
            <ActionButton
              label="Cerrar"
              url={`/api/platform/tickets/${ticket.id}/estado`}
              body={{ estado: "CERRADO" }}
              variant="danger"
              size="sm"
              confirmar="¿Cerrar este ticket?"
            />
          ) : null}
          {ticket.estado !== "ABIERTO" ? (
            <ActionButton
              label="Reabrir"
              url={`/api/platform/tickets/${ticket.id}/estado`}
              body={{ estado: "ABIERTO" }}
              variant="secondary"
              size="sm"
            />
          ) : null}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <h2>Mensajes</h2>
        </div>
        <div className="stack" style={{ gap: 0, padding: 16 }}>
          {ticket.mensajes.map((mensaje) => (
            <div
              key={mensaje.id}
              style={{
                padding: "12px 14px",
                marginBottom: 12,
                borderRadius: 8,
                background: mensaje.esSuperAdmin ? "var(--surface-2)" : "transparent",
                border: "1px solid var(--border)",
              }}
            >
              <div className="row-between" style={{ marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                <div className="row" style={{ gap: 8, alignItems: "center" }}>
                  <strong style={{ fontSize: 13.5 }}>
                    {mensaje.autor.nombre} {mensaje.autor.apellido}
                  </strong>
                  {mensaje.esSuperAdmin ? <span className="badge badge-info">Matafuego SaaS</span> : null}
                </div>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  {formatFechaHora(mensaje.createdAt)}
                </span>
              </div>
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{mensaje.cuerpo}</p>
            </div>
          ))}
        </div>
        <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
          <ResponderTicketPlataformaForm id={ticket.id} />
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { listTicketsDeTenantPaginado, type TenantActor } from "@/server/soporte/service";
import { EstadoBadge, formatFechaHora } from "../_lib/estado-badge";
import { Pagination } from "../_components/Pagination";
import { NuevoTicketForm } from "./NuevoTicketForm";

export default async function SoportePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");

  const { page: pageParam } = await searchParams;
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };
  const { items: tickets, total, page, totalPages, pageSize } = await listTicketsDeTenantPaginado(actor, {
    page: pageParam ? Number(pageParam) : 1,
  });

  return (
    <div className="stack">
      <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="stack" style={{ gap: 5 }}>
          <h1>Soporte</h1>
          <p className="muted">
            {total} ticket{total === 1 ? "" : "s"} de soporte
          </p>
        </div>
        <NuevoTicketForm />
      </div>

      <div className="card" style={{ padding: 0 }}>
        {tickets.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            Todavía no hay tickets de soporte. Si necesitás ayuda, creá uno.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Asunto</th>
                    <th>Prioridad</th>
                    <th>Estado</th>
                    <th>Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>
                        <Link href={`/soporte/${ticket.id}`} style={{ fontWeight: 500, color: "var(--text)" }}>
                          {ticket.asunto}
                        </Link>
                      </td>
                      <td>{ticket.prioridad}</td>
                      <td>
                        <EstadoBadge estado={ticket.estado} />
                      </td>
                      <td className="mono">{formatFechaHora(ticket.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} basePath="/soporte" />
          </>
        )}
      </div>
    </div>
  );
}

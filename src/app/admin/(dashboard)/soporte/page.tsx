import Link from "next/link";
import { requireSuperAdmin } from "@/server/auth/current-user";
import { listTicketsPlataforma } from "@/server/soporte/service";
import { EstadoBadge, formatFechaHora } from "@/app/(protected)/_lib/estado-badge";
import { Pagination } from "@/app/(protected)/_components/Pagination";

export default async function SoportePlataformaPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requireSuperAdmin();
  const { page: pageParam } = await searchParams;
  const { items: tickets, total, page, totalPages, pageSize } = await listTicketsPlataforma(actor, {
    page: pageParam ? Number(pageParam) : 1,
  });

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 5 }}>
        <h1>Soporte</h1>
        <p className="muted">
          {total} ticket{total === 1 ? "" : "s"} de soporte de todas las empresas
        </p>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {tickets.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            Todavía no hay tickets de soporte.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Asunto</th>
                    <th>Prioridad</th>
                    <th>Estado</th>
                    <th>Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="mono">{ticket.tenant.nombre}</td>
                      <td>
                        <Link href={`/admin/soporte/${ticket.id}`} style={{ fontWeight: 500, color: "var(--text)" }}>
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
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} basePath="/admin/soporte" />
          </>
        )}
      </div>
    </div>
  );
}

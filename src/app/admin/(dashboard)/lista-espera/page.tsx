import { requireSuperAdmin } from "@/server/auth/current-user";
import { listWaitlistLeads } from "@/server/waitlist/service";
import { formatFechaHora } from "@/app/(protected)/_lib/estado-badge";
import { Pagination } from "@/app/(protected)/_components/Pagination";

export default async function ListaEsperaPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requireSuperAdmin();
  const { page: pageParam } = await searchParams;
  const { items: leads, total, page, totalPages, pageSize } = await listWaitlistLeads(actor, {
    page: pageParam ? Number(pageParam) : 1,
  });

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 5 }}>
        <h1>Lista de espera</h1>
        <p className="muted">
          {total} persona{total === 1 ? "" : "s"} anotada{total === 1 ? "" : "s"} desde la landing
        </p>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {leads.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            Todavía no se anotó nadie.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Anotado</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td style={{ fontWeight: 500 }}>{lead.email}</td>
                      <td className="mono">{lead.telefono}</td>
                      <td className="mono">{formatFechaHora(lead.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} basePath="/admin/lista-espera" />
          </>
        )}
      </div>
    </div>
  );
}

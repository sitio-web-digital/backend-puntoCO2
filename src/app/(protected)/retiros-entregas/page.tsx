import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { listRetirosEntregasPaginado } from "@/server/retiros-entregas/service";
import { listMatafuegos } from "@/server/matafuegos/service";
import type { TenantActor } from "@/server/clientes/service";
import { EstadoBadge, formatFechaHora } from "../_lib/estado-badge";
import { NuevoRetiroForm } from "./NuevoRetiroForm";
import { Pagination } from "../_components/Pagination";

export default async function RetirosEntregasPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { page: pageParam } = await searchParams;
  const [{ items: registros, total, page, totalPages, pageSize }, matafuegos] = await Promise.all([
    listRetirosEntregasPaginado(actor, { page: pageParam ? Number(pageParam) : 1 }),
    listMatafuegos(actor),
  ]);

  return (
    <div className="stack">
      <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="stack" style={{ gap: 5 }}>
          <h1>Retiro, traslado y entrega</h1>
          <p className="muted">
            {total} registro{total === 1 ? "" : "s"} de retiro/entrega
          </p>
        </div>
        <NuevoRetiroForm matafuegos={matafuegos.map((m) => ({ id: m.id, codigoInterno: m.codigoInterno }))} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        {registros.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            Todavía no hay registros de retiro/entrega.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Fecha de retiro</th>
                    <th>Destino</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">
                        <Link href={`/retiros-entregas/${r.id}`}>{formatFechaHora(r.fechaHoraRetiro)}</Link>
                      </td>
                      <td>{r.destino ?? "—"}</td>
                      <td>
                        <EstadoBadge estado={r.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} basePath="/retiros-entregas" />
          </>
        )}
      </div>
    </div>
  );
}

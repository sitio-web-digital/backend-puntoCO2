import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { listNoConformidadesPaginado } from "@/server/no-conformidades/service";
import type { TenantActor } from "@/server/clientes/service";
import { EstadoBadge, formatFecha } from "../_lib/estado-badge";
import { Pagination } from "../_components/Pagination";

export default async function NoConformidadesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { page: pageParam } = await searchParams;
  const {
    items: noConformidades,
    total,
    page,
    totalPages,
    pageSize,
  } = await listNoConformidadesPaginado(actor, { page: pageParam ? Number(pageParam) : 1 });

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 6 }}>
        <h1>No conformidades</h1>
        <p className="muted" style={{ maxWidth: "80ch" }}>
          Se generan manualmente o a partir de una inspección con resultado no conforme. El alta se hace desde la ficha del matafuego o vía
          la inspección correspondiente.
        </p>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {noConformidades.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            No hay no conformidades registradas.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Defecto</th>
                    <th>Severidad</th>
                    <th>Riesgo</th>
                    <th>Fecha límite</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {noConformidades.map((nc) => (
                    <tr key={nc.id}>
                      <td>
                        <Link href={`/no-conformidades/${nc.id}`}>{nc.tipoDefecto}</Link>
                      </td>
                      <td>
                        <EstadoBadge estado={nc.severidad} />
                      </td>
                      <td>
                        <EstadoBadge estado={nc.nivelRiesgo} />
                      </td>
                      <td className="mono">{formatFecha(nc.fechaLimite)}</td>
                      <td>
                        <EstadoBadge estado={nc.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} basePath="/no-conformidades" />
          </>
        )}
      </div>
    </div>
  );
}

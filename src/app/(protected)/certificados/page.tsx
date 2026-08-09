import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { listCertificadosPaginado } from "@/server/certificados/service";
import { listOrdenesTrabajo } from "@/server/ordenes-trabajo/service";
import type { TenantActor } from "@/server/clientes/service";
import { EstadoBadge, formatFecha } from "../_lib/estado-badge";
import { EmitirCertificadoForm } from "./EmitirCertificadoForm";
import { Pagination } from "../_components/Pagination";

export default async function CertificadosPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { page: pageParam } = await searchParams;
  const [{ items: certificados, total, page, totalPages, pageSize }, ordenes] = await Promise.all([
    listCertificadosPaginado(actor, { page: pageParam ? Number(pageParam) : 1 }),
    listOrdenesTrabajo(actor),
  ]);
  const ordenesElegibles = ordenes.filter((o) => ["FINALIZADA", "ENTREGADA", "FACTURADA"].includes(o.estado));

  return (
    <div className="stack">
      <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="stack" style={{ gap: 5 }}>
          <h1>Certificados</h1>
          <p className="muted">
            {total} documento{total === 1 ? "" : "s"} emitido{total === 1 ? "" : "s"}
          </p>
        </div>
        <EmitirCertificadoForm ordenes={ordenesElegibles.map((o) => ({ id: o.id, numero: o.numero }))} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        {certificados.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            Todavía no hay certificados emitidos.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Vigencia</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {certificados.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/certificados/${c.id}`} className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>
                          #{c.numero}
                        </Link>
                      </td>
                      <td>{c.tipo}</td>
                      <td className="mono">{formatFecha(c.fecha)}</td>
                      <td className="mono">{formatFecha(c.vigenciaHasta)}</td>
                      <td>
                        <EstadoBadge estado={c.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} basePath="/certificados" />
          </>
        )}
      </div>
    </div>
  );
}

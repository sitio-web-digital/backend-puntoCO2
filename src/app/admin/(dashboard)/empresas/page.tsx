import Link from "next/link";
import { requireSuperAdmin } from "@/server/auth/current-user";
import { listTenantsPlataforma } from "@/server/platform/service";
import { EstadoBadge } from "@/app/(protected)/_lib/estado-badge";
import { Pagination } from "@/app/(protected)/_components/Pagination";
import { NuevaEmpresaForm } from "./NuevaEmpresaForm";

export default async function EmpresasPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requireSuperAdmin();
  const { page: pageParam } = await searchParams;
  const { items: tenants, total, page, totalPages, pageSize } = await listTenantsPlataforma(actor, {
    page: pageParam ? Number(pageParam) : 1,
  });

  return (
    <div className="stack">
      <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="stack" style={{ gap: 5 }}>
          <h1>Empresas</h1>
          <p className="muted">
            {total} empresa{total === 1 ? "" : "s"} registrada{total === 1 ? "" : "s"} en la plataforma
          </p>
        </div>
        <NuevaEmpresaForm />
      </div>

      <div className="card" style={{ padding: 0 }}>
        {tenants.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            Todavía no hay empresas registradas.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Identificador</th>
                    <th>Usuarios</th>
                    <th>Matafuegos</th>
                    <th>Estado</th>
                    <th>Vigencia hasta</th>
                    <th>Alta</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/admin/empresas/${t.id}`} style={{ fontWeight: 500, color: "var(--text)" }}>
                          {t.nombre}
                        </Link>
                      </td>
                      <td className="mono">{t.slug}</td>
                      <td className="mono">{t._count.usuarios}</td>
                      <td className="mono">{t._count.matafuegos}</td>
                      <td>
                        <EstadoBadge estado={t.estado} />
                      </td>
                      <td className="mono">{t.vigenciaHasta ? new Date(t.vigenciaHasta).toLocaleDateString("es-AR") : "—"}</td>
                      <td className="mono">{new Date(t.createdAt).toLocaleDateString("es-AR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} basePath="/admin/empresas" />
          </>
        )}
      </div>
    </div>
  );
}

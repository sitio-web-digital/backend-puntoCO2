import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { listMatafuegosPaginado } from "@/server/matafuegos/service";
import { listClientes } from "@/server/clientes/service";
import type { TenantActor } from "@/server/clientes/service";
import { EstadoBadge } from "../_lib/estado-badge";
import { EditarMatafuegoForm } from "./[id]/EditarMatafuegoForm";
import { NuevoMatafuegoForm } from "./NuevoMatafuegoForm";
import { Pagination } from "../_components/Pagination";

function nombreCliente(cliente: { tipoCliente: string; nombre: string | null; apellido: string | null; razonSocial: string | null }) {
  if (cliente.tipoCliente === "PERSONA_JURIDICA") return cliente.razonSocial ?? "(sin razón social)";
  return [cliente.nombre, cliente.apellido].filter(Boolean).join(" ") || "(sin nombre)";
}

export default async function MatafuegosPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { page: pageParam } = await searchParams;
  const [{ items: matafuegos, total, page, totalPages, pageSize }, clientes] = await Promise.all([
    listMatafuegosPaginado(actor, { page: pageParam ? Number(pageParam) : 1 }),
    listClientes(actor),
  ]);

  return (
    <div className="stack">
      <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="stack" style={{ gap: 5 }}>
          <h1>Matafuegos</h1>
          <p className="muted" style={{ margin: 0 }}>
            El alta de una unidad pide el cliente y establecimiento propietario. También podés cargarlas en lote desde la ficha del
            establecimiento (importar Excel).
          </p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          {matafuegos.length > 0 ? (
            <Link href="/matafuegos/imprimir-qr" className="btn-secondary">
              Imprimir QRs
            </Link>
          ) : null}
          <NuevoMatafuegoForm clientes={clientes.map((c) => ({ id: c.id, nombre: nombreCliente(c) }))} />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {matafuegos.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            Todavía no hay matafuegos cargados.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Código interno</th>
                    <th>N° de serie</th>
                    <th>Tipo</th>
                    <th>Agente</th>
                    <th>Estado</th>
                    <th>QR público</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {matafuegos.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link href={`/matafuegos/${m.id}`} className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>
                          {m.codigoInterno}
                        </Link>
                      </td>
                      <td className="mono">{m.numeroSerie}</td>
                      <td>{m.tipo}</td>
                      <td>{m.agenteExtintor}</td>
                      <td>
                        <EstadoBadge estado={m.estado} />
                      </td>
                      <td>
                        <Link href={`/qr/${m.qrToken}`} target="_blank">
                          Ver ficha QR ↗
                        </Link>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <EditarMatafuegoForm matafuego={m} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} basePath="/matafuegos" />
          </>
        )}
      </div>
    </div>
  );
}

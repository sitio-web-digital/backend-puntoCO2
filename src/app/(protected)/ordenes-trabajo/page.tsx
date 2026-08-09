import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { listOrdenesTrabajoPaginado } from "@/server/ordenes-trabajo/service";
import { listClientes } from "@/server/clientes/service";
import { listMatafuegos } from "@/server/matafuegos/service";
import type { TenantActor } from "@/server/clientes/service";
import { EstadoBadge, formatFecha } from "../_lib/estado-badge";
import { NuevaOrdenForm } from "./NuevaOrdenForm";
import { Pagination } from "../_components/Pagination";

function nombreCliente(cliente: { tipoCliente: string; nombre: string | null; apellido: string | null; razonSocial: string | null }) {
  if (cliente.tipoCliente === "PERSONA_JURIDICA") return cliente.razonSocial ?? "(sin razón social)";
  return [cliente.nombre, cliente.apellido].filter(Boolean).join(" ") || "(sin nombre)";
}

export default async function OrdenesTrabajoPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { page: pageParam } = await searchParams;
  const [{ items: ordenes, total, page, totalPages, pageSize }, clientes, matafuegos] = await Promise.all([
    listOrdenesTrabajoPaginado(actor, { page: pageParam ? Number(pageParam) : 1 }),
    listClientes(actor),
    listMatafuegos(actor),
  ]);

  return (
    <div className="stack">
      <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="stack" style={{ gap: 5 }}>
          <h1>Órdenes de trabajo</h1>
          <p className="muted">
            {total} orden{total === 1 ? "" : "es"} de trabajo cargada{total === 1 ? "" : "s"}
          </p>
        </div>
        <NuevaOrdenForm
          clientes={clientes.map((c) => ({ id: c.id, nombre: nombreCliente(c) }))}
          matafuegos={matafuegos.map((m) => ({ id: m.id, codigoInterno: m.codigoInterno, clienteId: m.clienteId }))}
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        {ordenes.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            Todavía no hay órdenes de trabajo cargadas.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Prioridad</th>
                    <th>Fecha apertura</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenes.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/ordenes-trabajo/${o.id}`} className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>
                          #{o.numero}
                        </Link>
                      </td>
                      <td>
                        <EstadoBadge estado={o.prioridad} />
                      </td>
                      <td className="mono">{formatFecha(o.fechaApertura)}</td>
                      <td>
                        <EstadoBadge estado={o.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} basePath="/ordenes-trabajo" />
          </>
        )}
      </div>
    </div>
  );
}

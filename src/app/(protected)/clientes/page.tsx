import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { listClientesPaginado, type TenantActor } from "@/server/clientes/service";
import { NuevoClienteForm } from "./NuevoClienteForm";
import { ImportarClientesButton } from "./ImportarClientesButton";
import { EditarClienteForm } from "./[id]/EditarClienteForm";
import { Pagination } from "../_components/Pagination";

function nombreCliente(cliente: { tipoCliente: string; nombre: string | null; apellido: string | null; razonSocial: string | null }) {
  if (cliente.tipoCliente === "PERSONA_JURIDICA") return cliente.razonSocial ?? "(sin razón social)";
  return [cliente.nombre, cliente.apellido].filter(Boolean).join(" ") || "(sin nombre)";
}

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");

  const { page: pageParam } = await searchParams;
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };
  const { items: clientes, total, page, totalPages, pageSize } = await listClientesPaginado(actor, {
    page: pageParam ? Number(pageParam) : 1,
  });

  return (
    <div className="stack">
      <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="stack" style={{ gap: 5 }}>
          <h1>Clientes</h1>
          <p className="muted">
            {total} cliente{total === 1 ? "" : "s"} registrado{total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <ImportarClientesButton />
          <NuevoClienteForm />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {clientes.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            Todavía no hay clientes cargados.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>CUIT</th>
                    <th>Condición IVA</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((cliente) => (
                    <tr key={cliente.id}>
                      <td>
                        <Link href={`/clientes/${cliente.id}`}>{nombreCliente(cliente)}</Link>
                      </td>
                      <td className="mono">{cliente.cuit ?? "—"}</td>
                      <td>{cliente.condicionIva}</td>
                      <td>
                        <span className={`badge badge-${cliente.estado.toLowerCase()}`}>{cliente.estado}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <EditarClienteForm cliente={cliente} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} basePath="/clientes" />
          </>
        )}
      </div>
    </div>
  );
}

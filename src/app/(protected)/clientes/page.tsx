import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { listClientes, type TenantActor } from "@/server/clientes/service";
import { NuevoClienteForm } from "./NuevoClienteForm";

function nombreCliente(cliente: { tipoCliente: string; nombre: string | null; apellido: string | null; razonSocial: string | null }) {
  if (cliente.tipoCliente === "PERSONA_JURIDICA") return cliente.razonSocial ?? "(sin razón social)";
  return [cliente.nombre, cliente.apellido].filter(Boolean).join(" ") || "(sin nombre)";
}

export default async function ClientesPage() {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");

  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };
  const clientes = await listClientes(actor);

  return (
    <div className="stack">
      <div className="row-between">
        <h1>Clientes</h1>
      </div>

      <div className="card">
        <NuevoClienteForm />
      </div>

      <div className="card">
        {clientes.length === 0 ? (
          <p className="muted">Todavía no hay clientes cargados.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>CUIT</th>
                <th>Condición IVA</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.id}>
                  <td>
                    <Link href={`/clientes/${cliente.id}`}>{nombreCliente(cliente)}</Link>
                  </td>
                  <td>{cliente.cuit ?? "—"}</td>
                  <td>{cliente.condicionIva}</td>
                  <td>
                    <span className={`badge badge-${cliente.estado.toLowerCase()}`}>{cliente.estado}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

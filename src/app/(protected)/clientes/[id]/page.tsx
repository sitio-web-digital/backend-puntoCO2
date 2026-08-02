import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { getCliente, type TenantActor } from "@/server/clientes/service";
import { listEstablecimientosDeCliente } from "@/server/establecimientos/service";
import { NuevoEstablecimientoForm } from "./NuevoEstablecimientoForm";

function nombreCliente(cliente: { tipoCliente: string; nombre: string | null; apellido: string | null; razonSocial: string | null }) {
  if (cliente.tipoCliente === "PERSONA_JURIDICA") return cliente.razonSocial ?? "(sin razón social)";
  return [cliente.nombre, cliente.apellido].filter(Boolean).join(" ") || "(sin nombre)";
}

export default async function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { id } = await params;
  const cliente = await getCliente(actor, id).catch(() => null);
  if (!cliente) notFound();

  const establecimientos = await listEstablecimientosDeCliente(actor, id);

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 4 }}>
        <Link href="/clientes" className="muted">
          ← Clientes
        </Link>
        <div className="row-between">
          <h1>{nombreCliente(cliente)}</h1>
          <span className={`badge badge-${cliente.estado.toLowerCase()}`}>{cliente.estado}</span>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ gap: 32, flexWrap: "wrap" }}>
          <div>
            <label>CUIT</label>
            <div>{cliente.cuit ?? "—"}</div>
          </div>
          <div>
            <label>Condición IVA</label>
            <div>{cliente.condicionIva}</div>
          </div>
          <div>
            <label>Email</label>
            <div>{cliente.email ?? "—"}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>Establecimientos</h2>
        <NuevoEstablecimientoForm clienteId={cliente.id} />

        {establecimientos.length === 0 ? (
          <p className="muted" style={{ marginTop: 16 }}>
            Este cliente todavía no tiene establecimientos cargados.
          </p>
        ) : (
          <table style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Provincia</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {establecimientos.map((est) => (
                <tr key={est.id}>
                  <td>{est.nombre}</td>
                  <td>{est.provincia ?? "—"}</td>
                  <td>
                    <span className={`badge badge-${est.estado.toLowerCase()}`}>{est.estado}</span>
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

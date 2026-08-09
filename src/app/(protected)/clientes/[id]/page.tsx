import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { getCliente, type TenantActor } from "@/server/clientes/service";
import { listEstablecimientosDeCliente } from "@/server/establecimientos/service";
import { EstablecimientosHeader } from "./NuevoEstablecimientoForm";
import { ImportarMatafuegosButton } from "./ImportarMatafuegosButton";
import { EditarClienteForm } from "./EditarClienteForm";
import { ActionButton } from "../../_components/ActionButton";

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
      <div className="stack" style={{ gap: 10 }}>
        <Link href="/clientes" className="back-link">
          ← Clientes
        </Link>
        <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            <h1>{nombreCliente(cliente)}</h1>
            <span className={`badge badge-${cliente.estado.toLowerCase()}`}>{cliente.estado}</span>
          </div>
          <EditarClienteForm cliente={cliente} />
        </div>
      </div>

      <div className="card">
        <div className="detail-grid">
          <div>
            <label>CUIT</label>
            <div className="mono" style={{ fontSize: 14.5, fontWeight: 500 }}>
              {cliente.cuit ?? "—"}
            </div>
          </div>
          <div>
            <label>Condición IVA</label>
            <div style={{ fontSize: 14.5 }}>{cliente.condicionIva}</div>
          </div>
          <div>
            <label>Tipo de consumidor</label>
            <div style={{ fontSize: 14.5 }}>{cliente.tipoConsumidor}</div>
          </div>
          <div>
            <label>Email</label>
            <div style={{ fontSize: 14.5 }}>{cliente.email ?? "—"}</div>
          </div>
          <div>
            <label>WhatsApp</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {cliente.whatsapp ?? "—"}
            </div>
          </div>
          <div>
            <label>Provincia</label>
            <div style={{ fontSize: 14.5 }}>{cliente.provincia ?? "—"}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <EstablecimientosHeader clienteId={cliente.id} count={establecimientos.length}>
          {establecimientos.length === 0 ? (
            <p className="muted" style={{ padding: 16 }}>
              Este cliente todavía no tiene establecimientos cargados.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Provincia</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {establecimientos.map((est) => (
                    <tr key={est.id}>
                      <td style={{ fontWeight: 500 }}>
                        <Link href={`/establecimientos/${est.id}`}>{est.nombre}</Link>
                      </td>
                      <td>{est.provincia ?? "—"}</td>
                      <td>
                        <span className={`badge badge-${est.estado.toLowerCase()}`}>{est.estado}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <ImportarMatafuegosButton establecimientoId={est.id} establecimientoNombre={est.nombre} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </EstablecimientosHeader>
      </div>

      {cliente.estado !== "DADO_DE_BAJA" ? (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
            <h2>Acciones</h2>
          </div>
          <div className="actions-bar" style={{ padding: "12px 16px" }}>
            <ActionButton
              label="Dar de baja"
              url={`/api/clientes/${cliente.id}`}
              method="DELETE"
              pedirMotivoComo="motivo"
              variant="danger"
              confirmar="¿Dar de baja a este cliente? Se conserva el registro pero deja de estar activo."
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { listMatafuegos } from "@/server/matafuegos/service";
import type { TenantActor } from "@/server/clientes/service";

export default async function MatafuegosPage() {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const matafuegos = await listMatafuegos(actor);

  return (
    <div className="stack">
      <h1>Matafuegos</h1>
      <p className="muted">Alta de unidades disponible por API (POST /api/matafuegos) — la pantalla de carga se suma con RF-06.</p>

      <div className="card">
        {matafuegos.length === 0 ? (
          <p className="muted">Todavía no hay matafuegos cargados.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Código interno</th>
                <th>N° de serie</th>
                <th>Tipo</th>
                <th>Agente</th>
                <th>Estado</th>
                <th>QR público</th>
              </tr>
            </thead>
            <tbody>
              {matafuegos.map((m) => (
                <tr key={m.id}>
                  <td>{m.codigoInterno}</td>
                  <td>{m.numeroSerie}</td>
                  <td>{m.tipo}</td>
                  <td>{m.agenteExtintor}</td>
                  <td>
                    <span className="badge">{m.estado}</span>
                  </td>
                  <td>
                    <Link href={`/qr/${m.qrToken}`} target="_blank">
                      Ver ficha QR ↗
                    </Link>
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

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { getMatafuego, listMovimientosDeMatafuego } from "@/server/matafuegos/service";
import { getCliente, type TenantActor } from "@/server/clientes/service";
import { getEstablecimiento } from "@/server/establecimientos/service";
import { listInspecciones } from "@/server/inspecciones/service";
import { listNoConformidades } from "@/server/no-conformidades/service";
import { listMantenimientos } from "@/server/mantenimientos/service";
import { EstadoBadge, formatFecha, formatFechaHora } from "../../_lib/estado-badge";
import { ActionButton } from "../../_components/ActionButton";
import { NuevaInspeccionForm } from "./NuevaInspeccionForm";
import { NuevaNoConformidadForm } from "./NuevaNoConformidadForm";
import { EditarMatafuegoForm } from "./EditarMatafuegoForm";

export default async function MatafuegoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { id } = await params;
  const matafuego = await getMatafuego(actor, id).catch(() => null);
  if (!matafuego) notFound();

  const [cliente, establecimiento, inspecciones, noConformidades, mantenimientos, movimientos] = await Promise.all([
    getCliente(actor, matafuego.clienteId).catch(() => null),
    getEstablecimiento(actor, matafuego.establecimientoId).catch(() => null),
    listInspecciones(actor, { matafuegoId: matafuego.id }),
    listNoConformidades(actor, { matafuegoId: matafuego.id }),
    listMantenimientos(actor, { matafuegoId: matafuego.id }),
    listMovimientosDeMatafuego(actor, matafuego.id),
  ]);

  const nombreCliente = cliente
    ? cliente.tipoCliente === "PERSONA_JURIDICA"
      ? (cliente.razonSocial ?? "—")
      : [cliente.nombre, cliente.apellido].filter(Boolean).join(" ")
    : "—";

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 10 }}>
        <Link href="/matafuegos" className="back-link">
          ← Matafuegos
        </Link>
        <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            <h1>{matafuego.codigoInterno}</h1>
            <EstadoBadge estado={matafuego.estado} />
          </div>
          <EditarMatafuegoForm matafuego={matafuego} />
        </div>
      </div>

      <div className="card stack" style={{ gap: 16 }}>
        <div className="detail-grid">
          <div>
            <label>N° de serie</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {matafuego.numeroSerie}
            </div>
          </div>
          <div>
            <label>Tipo</label>
            <div style={{ fontSize: 14.5 }}>{matafuego.tipo}</div>
          </div>
          <div>
            <label>Agente extintor</label>
            <div style={{ fontSize: 14.5 }}>{matafuego.agenteExtintor}</div>
          </div>
          <div>
            <label>Capacidad</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {matafuego.capacidadNominal ?? "—"}
            </div>
          </div>
          <div>
            <label>Marca / modelo</label>
            <div style={{ fontSize: 14.5 }}>
              {matafuego.marca ?? "—"} {matafuego.modelo ?? ""}
            </div>
          </div>
          <div>
            <label>Cliente</label>
            <div style={{ fontSize: 14.5 }}>{cliente ? <Link href={`/clientes/${cliente.id}`}>{nombreCliente}</Link> : "—"}</div>
          </div>
          <div>
            <label>Establecimiento</label>
            <div style={{ fontSize: 14.5 }}>{establecimiento?.nombre ?? "—"}</div>
          </div>
          <div>
            <label>QR público</label>
            <div style={{ fontSize: 14.5 }}>
              <Link href={`/qr/${matafuego.qrToken}`} target="_blank">
                Ver ficha ↗
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <h2>Acciones</h2>
        </div>
        <div className="actions-bar" style={{ padding: "12px 16px" }}>
          <Link href={`/matafuegos/imprimir-qr?ids=${matafuego.id}`} className="btn-secondary">
            Imprimir QR
          </Link>
          <ActionButton label="Regenerar QR" url={`/api/matafuegos/${matafuego.id}/regenerar-qr`} confirmar="El QR anterior deja de funcionar. ¿Continuar?" />
          {matafuego.estado !== "DADO_DE_BAJA" ? (
            <ActionButton
              label="Dar de baja"
              url={`/api/matafuegos/${matafuego.id}`}
              method="DELETE"
              pedirMotivoComo="motivo"
              variant="danger"
              confirmar="¿Dar de baja a esta unidad? Se conserva el registro pero deja de estar activa."
            />
          ) : null}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>Próximos vencimientos</h2>
        <div className="detail-grid">
          <div>
            <label>Próxima inspección</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {formatFecha(matafuego.proximaInspeccion)}
            </div>
          </div>
          <div>
            <label>Próxima recarga</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {formatFecha(matafuego.proximaRecarga)}
            </div>
          </div>
          <div>
            <label>Próxima prueba hidráulica</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {formatFecha(matafuego.proximaPruebaHidraulica)}
            </div>
          </div>
          <div>
            <label>Próximo mantenimiento</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {formatFecha(matafuego.proximoMantenimiento)}
            </div>
          </div>
        </div>
      </div>

      <div className="stack" style={{ gap: 16 }}>
        <h2>Registrar inspección</h2>
        <NuevaInspeccionForm matafuegoId={matafuego.id} />
      </div>

      <div className="stack" style={{ gap: 12 }}>
        <h2>Historial de inspecciones</h2>
        <div className="card">
          {inspecciones.length === 0 ? (
            <p className="muted">Todavía no hay inspecciones registradas.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Resultado</th>
                  <th>Comentarios</th>
                </tr>
              </thead>
              <tbody>
                {inspecciones.map((i) => (
                  <tr key={i.id}>
                    <td className="mono">{formatFechaHora(i.fechaHora)}</td>
                    <td>
                      <EstadoBadge estado={i.resultado} />
                    </td>
                    <td>{i.comentarios ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="stack" style={{ gap: 12 }}>
        <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
          <h2>Observaciones</h2>
          <NuevaNoConformidadForm matafuegoId={matafuego.id} />
        </div>
        <div className="card">
          {noConformidades.length === 0 ? (
            <p className="muted">No tiene observaciones registradas.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Defecto</th>
                  <th>Severidad</th>
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
                      <EstadoBadge estado={nc.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="stack" style={{ gap: 12 }}>
        <h2>Mantenimientos programados</h2>
        <div className="card">
          {mantenimientos.length === 0 ? (
            <p className="muted">No tiene mantenimientos programados.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Tipo de servicio</th>
                  <th>Fecha programada</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {mantenimientos.map((m) => (
                  <tr key={m.id}>
                    <td>{m.tipoServicio}</td>
                    <td className="mono">{formatFecha(m.fechaProgramada)}</td>
                    <td>
                      <EstadoBadge estado={m.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="stack" style={{ gap: 12 }}>
        <h2>Historial de movimientos</h2>
        <div className="card">
          {movimientos.length === 0 ? (
            <p className="muted">Sin movimientos registrados.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((mov) => (
                  <tr key={mov.id}>
                    <td className="mono">{formatFechaHora(mov.createdAt)}</td>
                    <td>{mov.motivo ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

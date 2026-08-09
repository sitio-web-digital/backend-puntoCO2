import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { getRetiroEntrega } from "@/server/retiros-entregas/service";
import { getMatafuego } from "@/server/matafuegos/service";
import type { TenantActor } from "@/server/clientes/service";
import { EstadoBadge, formatFechaHora } from "../../_lib/estado-badge";
import { ActionButton } from "../../_components/ActionButton";
import { IngresarTallerForm } from "./IngresarTallerForm";
import { RegistrarEntregaForm } from "./RegistrarEntregaForm";
import { ActualizarUbicacionForm } from "./ActualizarUbicacionForm";

const ETAPAS = [
  { estado: "RETIRADO", label: "Retiro" },
  { estado: "EN_TRASLADO", label: "Traslado" },
  { estado: "EN_TALLER", label: "Taller" },
  { estado: "ENTREGADO", label: "Entrega" },
];

function colorEtapa(index: number, currentIndex: number, estadoActual: string): string {
  if (currentIndex === -1) return "var(--text-3)";
  if (index < currentIndex) return "var(--ok)";
  if (index === currentIndex) return estadoActual === "ENTREGADO" ? "var(--ok)" : "var(--warn)";
  return "var(--text-3)";
}

export default async function RetiroDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { id } = await params;
  const registro = await getRetiroEntrega(actor, id).catch(() => null);
  if (!registro) notFound();

  const matafuego = await getMatafuego(actor, registro.matafuegoId).catch(() => null);
  const currentIndex = ETAPAS.findIndex((e) => e.estado === registro.estado);

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 10 }}>
        <Link href="/retiros-entregas" className="back-link">
          ← Retiro, traslado y entrega
        </Link>
        <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
          <h1>Retiro de {matafuego?.codigoInterno ?? "unidad"}</h1>
          <EstadoBadge estado={registro.estado} />
        </div>
      </div>

      {registro.estado !== "CANCELADO" ? (
        <div className="card" style={{ padding: "13px 17px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
            }}
          >
            {ETAPAS.map((etapa, i) => (
              <span key={etapa.estado} style={{ display: "flex", alignItems: "center" }}>
                <span style={{ color: colorEtapa(i, currentIndex, registro.estado) }}>{etapa.label}</span>
                {i < ETAPAS.length - 1 ? (
                  <span style={{ width: 26, height: 1, background: "var(--border-strong)", margin: "0 10px" }} />
                ) : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card stack" style={{ gap: 16 }}>
        <div className="detail-grid">
          <div>
            <label>Unidad</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {matafuego ? <Link href={`/matafuegos/${matafuego.id}`}>{matafuego.codigoInterno}</Link> : "—"}
            </div>
          </div>
          <div>
            <label>Fecha de retiro</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {formatFechaHora(registro.fechaHoraRetiro)}
            </div>
          </div>
          <div>
            <label>Persona que entrega</label>
            <div style={{ fontSize: 14.5 }}>{registro.personaQueEntrega ?? "—"}</div>
          </div>
          <div>
            <label>Persona que retira</label>
            <div style={{ fontSize: 14.5 }}>{registro.personaQueRetira ?? "—"}</div>
          </div>
          <div>
            <label>Vehículo</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {registro.vehiculo ?? "—"}
            </div>
          </div>
          <div>
            <label>Destino</label>
            <div style={{ fontSize: 14.5 }}>{registro.destino ?? "—"}</div>
          </div>
          <div>
            <label>Estado de la unidad al retirar</label>
            <div style={{ fontSize: 14.5 }}>{registro.estadoUnidadRetiro ?? "—"}</div>
          </div>
          <div>
            <label>Ubicación interna (taller)</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {registro.ubicacionInterna ?? "—"}
            </div>
          </div>
        </div>

        {registro.estado === "ENTREGADO" ? (
          <div className="grid2" style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
            <div>
              <label>Firma de recepción</label>
              <div style={{ fontSize: 14.5 }}>{registro.firmaRecepcionNombre}</div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <h2>Acciones</h2>
        </div>
        {["ENTREGADO", "CANCELADO"].includes(registro.estado) ? (
          <p className="muted" style={{ padding: "12px 16px" }}>
            No admite más acciones.
          </p>
        ) : (
          <div className="actions-bar" style={{ padding: "12px 16px" }}>
            {registro.estado === "RETIRADO" ? (
              <ActionButton label="Iniciar traslado" url={`/api/retiros-entregas/${registro.id}/iniciar-traslado`} />
            ) : null}
            {["RETIRADO", "EN_TRASLADO"].includes(registro.estado) ? <IngresarTallerForm id={registro.id} /> : null}
            {registro.estado === "EN_TALLER" ? <ActualizarUbicacionForm id={registro.id} /> : null}
            <RegistrarEntregaForm id={registro.id} />
            <ActionButton label="Cancelar" url={`/api/retiros-entregas/${registro.id}/cancelar`} pedirMotivoComo="motivo" variant="danger" />
          </div>
        )}
      </div>
    </div>
  );
}

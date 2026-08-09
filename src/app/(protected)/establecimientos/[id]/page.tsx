import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { getEstablecimiento } from "@/server/establecimientos/service";
import { listSectoresDeEstablecimiento, listUbicacionesDeSector } from "@/server/sectores/service";
import { listMatafuegos } from "@/server/matafuegos/service";
import type { TenantActor } from "@/server/clientes/service";
import { ActionButton } from "../../_components/ActionButton";
import { EditarEstablecimientoForm } from "./EditarEstablecimientoForm";
import { SectoresPanel } from "./SectoresPanel";
import { MatafuegosPanel } from "./MatafuegosPanel";

export default async function EstablecimientoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { id } = await params;
  const establecimiento = await getEstablecimiento(actor, id).catch(() => null);
  if (!establecimiento) notFound();

  const sectores = await listSectoresDeEstablecimiento(actor, id);
  const sectoresConUbicaciones = await Promise.all(
    sectores.map(async (sector) => ({ ...sector, ubicaciones: await listUbicacionesDeSector(actor, sector.id) })),
  );
  const matafuegos = await listMatafuegos(actor, { establecimientoId: id });

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 10 }}>
        <Link href={`/clientes/${establecimiento.clienteId}`} className="back-link">
          ← Volver al cliente
        </Link>
        <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            <h1>{establecimiento.nombre}</h1>
            <span className={`badge badge-${establecimiento.estado.toLowerCase()}`}>{establecimiento.estado}</span>
          </div>
          <EditarEstablecimientoForm establecimiento={establecimiento} />
        </div>
      </div>

      <div className="card">
        <div className="detail-grid">
          <div>
            <label>Dirección</label>
            <div style={{ fontSize: 14.5 }}>{establecimiento.direccion ?? "—"}</div>
          </div>
          <div>
            <label>Provincia / localidad</label>
            <div style={{ fontSize: 14.5 }}>
              {[establecimiento.provincia, establecimiento.localidad].filter(Boolean).join(" — ") || "—"}
            </div>
          </div>
          <div>
            <label>Responsable de seguridad</label>
            <div style={{ fontSize: 14.5 }}>{establecimiento.responsableSeguridad ?? "—"}</div>
          </div>
          <div>
            <label>Contacto operativo</label>
            <div style={{ fontSize: 14.5 }}>{establecimiento.contactoOperativo ?? "—"}</div>
          </div>
          <div>
            <label>Email</label>
            <div style={{ fontSize: 14.5 }}>{establecimiento.email ?? "—"}</div>
          </div>
          <div>
            <label>Teléfono</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {establecimiento.telefono ?? "—"}
            </div>
          </div>
          <div>
            <label>Horarios de atención</label>
            <div style={{ fontSize: 14.5 }}>{establecimiento.horariosAtencion ?? "—"}</div>
          </div>
          <div>
            <label>Normativa aplicable</label>
            <div style={{ fontSize: 14.5 }}>{establecimiento.normativaAplicable ?? "—"}</div>
          </div>
        </div>
        {establecimiento.indicacionesAcceso ? (
          <div className="field" style={{ marginTop: 20, marginBottom: 0 }}>
            <label>Indicaciones de acceso</label>
            <div style={{ fontSize: 14.5, lineHeight: 1.55 }}>{establecimiento.indicacionesAcceso}</div>
          </div>
        ) : null}
      </div>

      <SectoresPanel establecimientoId={establecimiento.id} sectores={sectoresConUbicaciones} />

      <MatafuegosPanel
        clienteId={establecimiento.clienteId}
        establecimientoId={establecimiento.id}
        sectores={sectoresConUbicaciones}
        matafuegos={matafuegos}
      />

      {establecimiento.estado !== "DADO_DE_BAJA" ? (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
            <h2>Acciones</h2>
          </div>
          <div className="actions-bar" style={{ padding: "12px 16px" }}>
            <ActionButton
              label="Dar de baja"
              url={`/api/establecimientos/${establecimiento.id}`}
              method="DELETE"
              pedirMotivoComo="motivo"
              variant="danger"
              confirmar="¿Dar de baja este establecimiento? Se conserva el registro pero deja de estar activo."
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

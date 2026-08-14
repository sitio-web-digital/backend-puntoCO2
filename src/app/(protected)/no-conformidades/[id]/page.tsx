import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { getNoConformidad } from "@/server/no-conformidades/service";
import { getMatafuego } from "@/server/matafuegos/service";
import { listUsuarios } from "@/server/usuarios/service";
import type { TenantActor } from "@/server/clientes/service";
import { EstadoBadge, formatFecha } from "../../_lib/estado-badge";
import { ActionButton } from "../../_components/ActionButton";
import { AsignarResponsableForm } from "./AsignarResponsableForm";
import { ResolverForm } from "./ResolverForm";

export default async function NoConformidadDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { id } = await params;
  const nc = await getNoConformidad(actor, id).catch(() => null);
  if (!nc) notFound();

  const matafuego = await getMatafuego(actor, nc.matafuegoId).catch(() => null);
  // listUsuarios exige permiso USUARIOS_ROLES:VER (sólo Administrador de
  // empresa) — un Responsable técnico puede asignar responsables sin tener
  // ese permiso, así que si falla, el formulario queda sin opciones en vez
  // de romper toda la página.
  const usuarios = await listUsuarios(actor).catch(() => []);

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 10 }}>
        <Link href="/no-conformidades" className="back-link">
          ← Observaciones
        </Link>
        <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
          <h1>{nc.tipoDefecto}</h1>
          <EstadoBadge estado={nc.estado} />
        </div>
      </div>

      <div className="card">
        <div className="detail-grid">
          <div>
            <label>Unidad</label>
            <div>{matafuego ? <Link href={`/matafuegos/${matafuego.id}`} className="mono">{matafuego.codigoInterno}</Link> : "—"}</div>
          </div>
          <div>
            <label>Severidad</label>
            <div>
              <EstadoBadge estado={nc.severidad} />
            </div>
          </div>
          <div>
            <label>Nivel de riesgo</label>
            <div>
              <EstadoBadge estado={nc.nivelRiesgo} />
            </div>
          </div>
          <div>
            <label>Fecha límite</label>
            <div className="mono">{formatFecha(nc.fechaLimite)}</div>
          </div>
          <div>
            <label>Requiere reinspección</label>
            <div>{nc.reinspeccionRequerida ? "Sí" : "No"}</div>
          </div>
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label>Descripción</label>
          <div>{nc.descripcion}</div>
        </div>

        {nc.accionInmediata ? (
          <div className="field">
            <label>Acción inmediata</label>
            <div>{nc.accionInmediata}</div>
          </div>
        ) : null}

        {nc.resolucion ? (
          <div className="field">
            <label>Resolución</label>
            <div>{nc.resolucion}</div>
          </div>
        ) : null}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <h2>Acciones</h2>
        </div>
        {["CERRADA", "DESCARTADA"].includes(nc.estado) ? (
          <p className="muted" style={{ padding: "12px 16px" }}>
            No admite más acciones.
          </p>
        ) : (
          <div className="actions-bar" style={{ padding: "12px 16px" }}>
            {["ABIERTA", "ASIGNADA", "EN_TRATAMIENTO"].includes(nc.estado) ? (
              <AsignarResponsableForm id={nc.id} usuarios={usuarios.map((u) => ({ id: u.id, nombre: `${u.nombre} ${u.apellido}` }))} />
            ) : null}
            {nc.estado === "ASIGNADA" ? <ActionButton label="Iniciar tratamiento" url={`/api/no-conformidades/${nc.id}/iniciar`} /> : null}
            {["ASIGNADA", "EN_TRATAMIENTO"].includes(nc.estado) ? <ResolverForm id={nc.id} /> : null}
            {nc.estado === "RESUELTA" ? (
              <ActionButton label="Verificar" url={`/api/no-conformidades/${nc.id}/verificar`} variant="primary" />
            ) : null}
            {["RESUELTA", "VERIFICADA"].includes(nc.estado) ? (
              <ActionButton label="Cerrar" url={`/api/no-conformidades/${nc.id}/cerrar`} variant="primary" />
            ) : null}
            {["ABIERTA", "ASIGNADA", "EN_TRATAMIENTO"].includes(nc.estado) ? (
              <ActionButton label="Descartar" url={`/api/no-conformidades/${nc.id}/descartar`} pedirMotivoComo="motivo" variant="danger" />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { getCertificado } from "@/server/certificados/service";
import type { TenantActor } from "@/server/clientes/service";
import { EstadoBadge, formatFecha } from "../../_lib/estado-badge";
import { ActionButton } from "../../_components/ActionButton";
import { ReemplazarCertificadoForm } from "./ReemplazarCertificadoForm";

export default async function CertificadoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { id } = await params;
  const certificado = await getCertificado(actor, id).catch(() => null);
  if (!certificado) notFound();

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 10 }}>
        <Link href="/certificados" className="back-link">
          ← Certificados
        </Link>
        <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
          <h1>Certificado #{certificado.numero}</h1>
          <EstadoBadge estado={certificado.estado} />
        </div>
      </div>

      <div className="card stack" style={{ gap: 16 }}>
        <div className="detail-grid">
          <div>
            <label>Tipo</label>
            <div style={{ fontSize: 14.5 }}>{certificado.tipo}</div>
          </div>
          <div>
            <label>Versión</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {certificado.version}
            </div>
          </div>
          <div>
            <label>Fecha de emisión</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {formatFecha(certificado.fecha)}
            </div>
          </div>
          <div>
            <label>Vigencia hasta</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {formatFecha(certificado.vigenciaHasta)}
            </div>
          </div>
          <div>
            <label>Responsable técnico</label>
            <div style={{ fontSize: 14.5 }}>{certificado.responsableTecnicoNombre ?? "—"}</div>
          </div>
        </div>

        <div className="grid2" style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
          <div>
            <label>Servicios realizados</label>
            <div style={{ fontSize: 14.5, lineHeight: 1.55 }}>{certificado.serviciosRealizados.join(", ") || "—"}</div>
          </div>
          <div>
            <label>Verificación pública</label>
            <div style={{ fontSize: 14.5 }}>
              <Link href={`/certificados/verificar/${certificado.qrToken}`} target="_blank">
                Ver página de verificación ↗
              </Link>
            </div>
          </div>
          {certificado.motivoAnulacion ? (
            <div>
              <label>Motivo de anulación</label>
              <div style={{ fontSize: 14.5 }}>{certificado.motivoAnulacion}</div>
            </div>
          ) : null}
          {certificado.motivoReemplazo ? (
            <div>
              <label>Motivo de reemplazo</label>
              <div style={{ fontSize: 14.5 }}>{certificado.motivoReemplazo}</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <h2>Acciones</h2>
        </div>
        {certificado.estado === "EMITIDO" ? (
          <div className="stack" style={{ gap: 12, padding: "12px 16px" }}>
            <p className="muted" style={{ fontSize: 12.5, color: "var(--text-3)", maxWidth: "70ch", margin: 0 }}>
              Los certificados tienen validez legal y no se editan: se anulan o se reemplazan por una nueva versión, dejando rastro.
            </p>
            <div className="actions-bar">
              <ReemplazarCertificadoForm id={certificado.id} />
              <ActionButton label="Anular" url={`/api/certificados/${certificado.id}/anular`} pedirMotivoComo="motivo" variant="danger" />
            </div>
          </div>
        ) : (
          <p className="muted" style={{ padding: "12px 16px" }}>
            No admite más acciones: el documento quedó {certificado.estado.toLowerCase()}.
          </p>
        )}
      </div>
    </div>
  );
}

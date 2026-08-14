import Link from "next/link";
import { resolveQrPublico, resolveMatafuegoIdYTenant, type QrPublicView } from "@/server/qr/service";
import { getCurrentUser } from "@/server/auth/current-user";

const ESTADO_LABEL: Record<string, string> = {
  INSTALADO: "Instalado",
  PENDIENTE_DE_CONTROL: "Pendiente de control",
  APTO: "Apto",
  OBSERVADO: "Observado",
  VENCIDO: "Vencido",
  RETIRADO: "Retirado",
  EN_TRASLADO: "En traslado",
  EN_TALLER: "En taller",
  EN_RECARGA: "En recarga",
  EN_PRUEBA_HIDRAULICA: "En prueba hidráulica",
  RECHAZADO: "Rechazado",
  FUERA_DE_SERVICIO: "Fuera de servicio",
  ENTREGADO: "Entregado",
  DADO_DE_BAJA: "Dado de baja",
  EXTRAVIADO: "Extraviado",
};

function formatFecha(fecha: Date | null): string {
  if (!fecha) return "No registrada";
  return new Date(fecha).toLocaleDateString("es-AR");
}

export default async function QrPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let vista: QrPublicView;
  try {
    vista = await resolveQrPublico(token);
  } catch {
    return (
      <main className="login-shell">
        <div className="login-card">
          <div className="login-card-accent" />
          <div className="login-card-body stack">
            <h1>Código no reconocido</h1>
            <p className="muted">Este código QR no corresponde a ninguna unidad registrada.</p>
          </div>
        </div>
      </main>
    );
  }

  const [user, matafuegoTenant] = await Promise.all([getCurrentUser(), resolveMatafuegoIdYTenant(token)]);
  const linkFichaCompleta =
    user && user.tenantId && matafuegoTenant && user.tenantId === matafuegoTenant.tenantId
      ? `/matafuegos/${matafuegoTenant.matafuegoId}`
      : null;

  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="login-card-accent" />
        <div className="login-card-body">
          <div className="stack" style={{ gap: 10 }}>
            <span className="mono" style={{ fontSize: 11.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-3)" }}>
              Matafuego · <span style={{ color: "var(--text-2)" }}>{vista.codigoInterno}</span>
            </span>
            <h1 style={{ fontSize: 25 }}>{vista.tipo.replace(/_/g, " ")}</h1>
            <span className={`badge badge-${vista.estado.toLowerCase()}`} style={{ width: "fit-content" }}>
              {ESTADO_LABEL[vista.estado] ?? vista.estado}
            </span>
          </div>

          <div className="stack" style={{ gap: 0, borderTop: "1px solid var(--border)", marginTop: 24 }}>
            <div className="row-between" style={{ padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
              <span className="muted">Agente extintor</span>
              <span className="mono" style={{ fontWeight: 500 }}>
                {vista.agenteExtintor.replace(/_/g, " ")}
              </span>
            </div>
            <div className="row-between" style={{ padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
              <span className="muted">Capacidad</span>
              <span className="mono" style={{ fontWeight: 500 }}>
                {vista.capacidadNominal ?? "No especificada"}
              </span>
            </div>
            <div className="row-between" style={{ padding: "13px 0", borderBottom: "1px solid var(--border)", gap: 16 }}>
              <span className="muted">Inspección</span>
              <span className="mono" style={{ fontWeight: 500, textAlign: "right", fontSize: 12.5 }}>
                últ. {formatFecha(vista.fechaUltimaInspeccion)}
                <br />
                próx. {formatFecha(vista.proximaInspeccion)}
              </span>
            </div>
            <div className="row-between" style={{ padding: "13px 0", borderBottom: "1px solid var(--border)", gap: 16 }}>
              <span className="muted">Mantenimiento</span>
              <span className="mono" style={{ fontWeight: 500, textAlign: "right", fontSize: 12.5 }}>
                últ. {formatFecha(vista.fechaUltimoMantenimiento)}
                <br />
                próx. {formatFecha(vista.proximoMantenimiento)}
              </span>
            </div>
            <div className="row-between" style={{ padding: "13px 0", borderBottom: "1px solid var(--border)", gap: 16 }}>
              <span className="muted">Recarga</span>
              <span className="mono" style={{ fontWeight: 500, textAlign: "right", fontSize: 12.5 }}>
                últ. {formatFecha(vista.fechaUltimaRecarga)}
                <br />
                próx. {formatFecha(vista.proximaRecarga)}
              </span>
            </div>
            <div className="row-between" style={{ padding: "13px 0", borderBottom: "1px solid var(--border)", gap: 16 }}>
              <span className="muted">Prueba hidráulica</span>
              <span className="mono" style={{ fontWeight: 500, textAlign: "right", fontSize: 12.5 }}>
                últ. {formatFecha(vista.fechaUltimaPruebaHidraulica)}
                <br />
                próx. {formatFecha(vista.proximaPruebaHidraulica)}
              </span>
            </div>
          </div>

          {linkFichaCompleta ? (
            <Link href={linkFichaCompleta} className="btn-primary" style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
              Ingresar a la ficha completa →
            </Link>
          ) : (
            <p className="muted" style={{ fontSize: 12, color: "var(--text-3)", marginTop: 24, marginBottom: 0 }}>
              ¿Sos técnico de la empresa responsable? Iniciá sesión para ver la ficha completa y registrar novedades.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

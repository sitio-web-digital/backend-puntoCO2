import { resolverCertificadoPublico } from "@/server/certificados/service";

function formatFecha(fecha: Date | string | null): string {
  if (!fecha) return "Sin vencimiento";
  return new Date(fecha).toLocaleDateString("es-AR");
}

export default async function VerificarCertificadoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let vista;
  try {
    vista = await resolverCertificadoPublico(token);
  } catch {
    return (
      <main className="login-shell">
        <div className="login-card">
          <div className="login-card-accent" />
          <div className="login-card-body stack">
            <h1>Código no reconocido</h1>
            <p className="muted">Este código QR no corresponde a ningún certificado registrado.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="login-card-accent" />
        <div className="login-card-body">
          <div className="stack" style={{ gap: 10 }}>
            <span className="mono" style={{ fontSize: 11.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-3)" }}>
              Certificado #{vista.numero} · versión {vista.version}
            </span>
            <h1 style={{ fontSize: 25 }}>{vista.tipo.replace(/_/g, " ")}</h1>
            <span className={`badge ${vista.vigente ? "badge-success" : "badge-danger"}`} style={{ width: "fit-content" }}>
              {vista.vigente ? "Vigente" : vista.estado.replace(/_/g, " ")}
            </span>
          </div>

          <div className="stack" style={{ gap: 0, borderTop: "1px solid var(--border)", marginTop: 24 }}>
            <div className="row-between" style={{ padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
              <span className="muted">Fecha de emisión</span>
              <span className="mono" style={{ fontWeight: 500 }}>
                {formatFecha(vista.fecha)}
              </span>
            </div>
            <div className="row-between" style={{ padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
              <span className="muted">Vigencia hasta</span>
              <span className="mono" style={{ fontWeight: 500 }}>
                {formatFecha(vista.vigenciaHasta)}
              </span>
            </div>
          </div>

          <p className="muted" style={{ fontSize: 12, color: "var(--text-3)", marginTop: 24, marginBottom: 0 }}>
            Este documento tiene validez legal según normativa IRAM. Verificá siempre su estado escaneando el código QR impreso.
          </p>
        </div>
      </div>
    </main>
  );
}

import { requireSuperAdmin } from "@/server/auth/current-user";
import { resumenPlataforma } from "@/server/platform/service";

const ESTADO_LABEL: Record<string, string> = {
  TRIAL: "Trial",
  ACTIVO: "Activas",
  SUSPENDIDO: "Suspendidas",
  VENCIDO: "Vencidas",
  CANCELADO: "Canceladas",
};

const ESTADO_BADGE_CLASS: Record<string, string> = {
  TRIAL: "badge-info",
  ACTIVO: "badge-success",
  SUSPENDIDO: "badge-warning",
  VENCIDO: "badge-danger",
  CANCELADO: "badge-neutral",
};

export default async function SuperAdminResumenPage() {
  await requireSuperAdmin();
  const resumen = await resumenPlataforma();

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 5 }}>
        <h1>Resumen de la plataforma</h1>
        <p className="muted">Cómo le está yendo a Matafuego SaaS en números, hoy.</p>
      </div>

      <div className="grid3">
        <div className="card stack" style={{ gap: 4 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Empresas totales
          </span>
          <span style={{ fontSize: 28, fontWeight: 600 }}>{resumen.totalEmpresas}</span>
        </div>
        <div className="card stack" style={{ gap: 4 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Usuarios en toda la plataforma
          </span>
          <span style={{ fontSize: 28, fontWeight: 600 }}>{resumen.totalUsuarios}</span>
        </div>
        <div className="card stack" style={{ gap: 4 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Matafuegos gestionados
          </span>
          <span style={{ fontSize: 28, fontWeight: 600 }}>{resumen.totalMatafuegos}</span>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 14 }}>Empresas por estado</h2>
        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
          {Object.entries(ESTADO_LABEL).map(([estado, label]) => (
            <span key={estado} className={`badge ${ESTADO_BADGE_CLASS[estado]}`}>
              {label}: {resumen.conteoPorEstado[estado] ?? 0}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

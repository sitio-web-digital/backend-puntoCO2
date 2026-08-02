import { resolveQrPublico } from "@/server/qr/service";

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

  let vista;
  try {
    vista = await resolveQrPublico(token);
  } catch {
    return (
      <main className="login-shell">
        <div className="card login-card stack">
          <h1>Código no reconocido</h1>
          <p className="muted">Este código QR no corresponde a ninguna unidad registrada.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="login-shell">
      <div className="card login-card stack">
        <div className="stack" style={{ gap: 4 }}>
          <p className="muted" style={{ marginBottom: 0 }}>
            Matafuego
          </p>
          <h1>{vista.tipo.replace(/_/g, " ")}</h1>
          <span className={`badge badge-${vista.estado.toLowerCase()}`} style={{ width: "fit-content" }}>
            {ESTADO_LABEL[vista.estado] ?? vista.estado}
          </span>
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <div className="row-between">
            <span className="muted">Agente extintor</span>
            <span>{vista.agenteExtintor.replace(/_/g, " ")}</span>
          </div>
          <div className="row-between">
            <span className="muted">Capacidad</span>
            <span>{vista.capacidadNominal ?? "No especificada"}</span>
          </div>
          <div className="row-between">
            <span className="muted">Próxima inspección</span>
            <span>{formatFecha(vista.proximaInspeccion)}</span>
          </div>
          <div className="row-between">
            <span className="muted">Próximo mantenimiento</span>
            <span>{formatFecha(vista.proximoMantenimiento)}</span>
          </div>
          <div className="row-between">
            <span className="muted">Próxima recarga</span>
            <span>{formatFecha(vista.proximaRecarga)}</span>
          </div>
          <div className="row-between">
            <span className="muted">Próxima prueba hidráulica</span>
            <span>{formatFecha(vista.proximaPruebaHidraulica)}</span>
          </div>
        </div>

        <p className="muted" style={{ fontSize: "0.8rem" }}>
          ¿Sos técnico de la empresa responsable? Iniciá sesión para ver la ficha completa y registrar novedades.
        </p>
      </div>
    </main>
  );
}

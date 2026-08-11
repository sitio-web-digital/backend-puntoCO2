import { CLIENTES_ROWS, estadoDe, type Estado } from "./mock-data";

function PhonePill({ variant, children }: { variant: Estado | "info"; children: string }) {
  return <span className={`mockup-phone-pill mockup-phone-pill-${variant}`}>{children}</span>;
}

const NAV_ITEMS = ["Clientes", "Escanear", "Órdenes", "Avisos"];

function navActivoPara(tabId: string): string {
  switch (tabId) {
    case "clientes":
      return "Clientes";
    case "matafuegos":
      return "Escanear";
    case "notificaciones":
      return "Avisos";
    default:
      return "Órdenes";
  }
}

const TITULOS: Record<string, string> = {
  clientes: "Clientes",
  matafuegos: "Escanear QR",
  certificados: "MAT-0231",
  reportes: "Inspección en campo",
  notificaciones: "Avisos",
};

function PantallaClientes() {
  return (
    <>
      {CLIENTES_ROWS.slice(0, 4).map((row) => (
        <div key={row[0]} className="mockup-phone-card">
          <div className="mockup-phone-card-row">
            <span className="mockup-phone-card-title">{row[0]}</span>
            <PhonePill variant={estadoDe(row[2]!)}>{row[2]!}</PhonePill>
          </div>
          <div className="mockup-phone-card-row">
            <span className="mockup-phone-mono">{row[1]}</span>
            <span className="mockup-phone-mono">{row[5]} unid.</span>
          </div>
        </div>
      ))}
    </>
  );
}

function PantallaEscanear() {
  return (
    <>
      <div className="mockup-phone-scan-box">
        <div className="mockup-phone-scan-grid" />
        <div className="mockup-phone-scan-frame">
          <span className="mockup-phone-scan-corner tl" />
          <span className="mockup-phone-scan-corner tr" />
          <span className="mockup-phone-scan-corner bl" />
          <span className="mockup-phone-scan-corner br" />
          <span className="mockup-phone-scan-line" />
        </div>
        <span className="mockup-phone-scan-caption">Apuntá a la etiqueta</span>
      </div>
      <div className="mockup-phone-card">
        <span className="mockup-phone-label">Última lectura</span>
        <div className="mockup-phone-card-row">
          <span className="mockup-phone-mono strong">MAT-0231</span>
          <PhonePill variant="ok">Apto</PhonePill>
        </div>
      </div>
    </>
  );
}

const DETALLE_CAMPOS = [
  { label: "Agente", valor: "Polvo ABC · 5 kg", mono: false },
  { label: "Próx. inspección", valor: "15/09/2026", mono: true },
  { label: "Próx. recarga", valor: "20/07/2027", mono: true },
  { label: "Ubicación", valor: "Sucursal Centro · Sector B", mono: false },
];

function PantallaCertificado() {
  return (
    <>
      <div className="mockup-phone-card">
        <div className="mockup-phone-card-row">
          <span className="mockup-phone-mono strong big">MAT-0231</span>
          <PhonePill variant="ok">Apto</PhonePill>
        </div>
        <div className="mockup-phone-detail-fields">
          {DETALLE_CAMPOS.map((campo) => (
            <div key={campo.label} className="mockup-phone-detail-row">
              <span className="mockup-phone-detail-label">{campo.label}</span>
              <span className={campo.mono ? "mockup-phone-mono" : undefined}>{campo.valor}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mockup-phone-actions">
        <span className="mockup-phone-btn primary">Cargar inspección</span>
        <span className="mockup-phone-btn secondary">Registrar retiro</span>
      </div>
    </>
  );
}

const CHECKLIST = [
  { label: "Precinto y sello", checked: true },
  { label: "Manómetro en verde", checked: true },
  { label: "Manguera y tobera", checked: true },
  { label: "Soporte y señalización", checked: false },
  { label: "Etiqueta legible", checked: false },
];

function PantallaInspeccion() {
  return (
    <>
      <div className="mockup-phone-card">
        <span className="mockup-phone-label">Checklist técnico</span>
        {CHECKLIST.map((item) => (
          <div key={item.label} className="mockup-phone-check-row">
            <span className={`mockup-phone-check${item.checked ? " checked" : ""}`}>{item.checked ? "✓" : ""}</span>
            <span className={`mockup-phone-check-label${item.checked ? "" : " muted"}`}>{item.label}</span>
          </div>
        ))}
      </div>
      <div className="mockup-phone-noconformidad">
        <span className="mockup-phone-label warn">No conformidad</span>
        <span className="mockup-phone-noconformidad-text">Soporte flojo · se genera seguimiento automático</span>
      </div>
      <span className="mockup-phone-btn primary">Firmar y cerrar</span>
    </>
  );
}

const AVISOS = [
  { titulo: "Vencimiento próximo", canal: "WhatsApp", variant: "ok" as const, desc: "6 unidades de La Espiga vencen este mes" },
  { titulo: "Certificado emitido", canal: "Email", variant: "ok" as const, desc: "#54 enviado a compras@laespiga.com.ar" },
  { titulo: "Orden asignada", canal: "Push", variant: "info" as const, desc: "Orden #126 · Sucursal Centro · hoy 14:00" },
  { titulo: "Mantenimiento atrasado", canal: "Email", variant: "warn" as const, desc: "San Martín SA · reintento programado" },
];

function PantallaAvisos() {
  return (
    <>
      {AVISOS.map((aviso) => (
        <div key={aviso.titulo} className="mockup-phone-card">
          <div className="mockup-phone-card-row">
            <span className="mockup-phone-card-title">{aviso.titulo}</span>
            <PhonePill variant={aviso.variant}>{aviso.canal}</PhonePill>
          </div>
          <span className="mockup-phone-desc">{aviso.desc}</span>
        </div>
      ))}
    </>
  );
}

function contenidoDePantalla(tabId: string) {
  switch (tabId) {
    case "clientes":
      return <PantallaClientes />;
    case "matafuegos":
      return <PantallaEscanear />;
    case "certificados":
      return <PantallaCertificado />;
    case "reportes":
      return <PantallaInspeccion />;
    case "notificaciones":
      return <PantallaAvisos />;
    default:
      return null;
  }
}

/** Celular flotando sobre la esquina inferior derecha del mockup del dashboard,
 * mostrando la misma sección pero como la vería un técnico en campo desde el
 * celular (vista simplificada, con su propia navegación de 4 secciones). */
export function PhoneMockup({ activeTab }: { activeTab: string }) {
  return (
    <div className="mockup-phone">
      <div className="mockup-phone-screen">
        <span className="mockup-phone-notch" />
        <div className="mockup-phone-header">
          <span className="mockup-phone-mark" />
          <span className="mockup-phone-title">{TITULOS[activeTab]}</span>
        </div>
        <div className="mockup-phone-body">{contenidoDePantalla(activeTab)}</div>
        <div className="mockup-phone-nav">
          {NAV_ITEMS.map((item) => (
            <span key={item} className={`mockup-phone-nav-item${item === navActivoPara(activeTab) ? " active" : ""}`}>
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

const NAV_GROUPS = [
  { label: "Operación", items: ["Clientes", "Matafuegos", "No conformidades", "Mantenimientos"] },
  { label: "Trabajo", items: ["Órdenes de trabajo", "Retiros y entregas"] },
  { label: "Documentación", items: ["Certificados", "Notificaciones", "Reportes"] },
];

type Estado = "ok" | "warn" | "bad" | "neutral";

function estadoDe(valor: string): Estado {
  if (["Activo", "Apto", "Emitido", "Enviada", "Entregada", "Leída"].includes(valor)) return "ok";
  if (["Suspendido", "Observado", "En taller", "Pendiente", "Reintento"].includes(valor)) return "warn";
  if (["Vencido"].includes(valor)) return "bad";
  return "neutral";
}

function Badge({ children }: { children: string }) {
  return <span className={`mock-badge mock-badge-${estadoDe(children)}`}>{children}</span>;
}

interface MockTab {
  id: string;
  tabLabel: string;
  sidebarActive: string;
  headerTitle: string;
}

const TABS: MockTab[] = [
  { id: "clientes", tabLabel: "Clientes", sidebarActive: "Clientes", headerTitle: "Clientes" },
  { id: "matafuegos", tabLabel: "Inventario", sidebarActive: "Matafuegos", headerTitle: "Matafuegos" },
  { id: "certificados", tabLabel: "Certificados", sidebarActive: "Certificados", headerTitle: "Certificado #54" },
  { id: "reportes", tabLabel: "Reportes", sidebarActive: "Reportes", headerTitle: "Reportes e indicadores" },
  { id: "notificaciones", tabLabel: "Notificaciones", sidebarActive: "Notificaciones", headerTitle: "Notificaciones" },
];

const CLIENTES_ROWS = [
  ["Supermercado La Espiga SRL", "30-71234567-8", "Activo", "Responsable inscripto", "3", "64"],
  ["Metalúrgica San Martín SA", "30-70123456-1", "Activo", "Responsable inscripto", "2", "41"],
  ["Farmacia Central — Roberto Díaz", "27-24567891-3", "Activo", "Monotributista", "1", "6"],
  ["Colegio San José", "30-65432198-7", "Suspendido", "Exento", "1", "18"],
  ["Distribuidora Los Álamos SRL", "30-69988776-4", "Dado de baja", "Responsable inscripto", "2", "27"],
];

const MATAFUEGOS_ROWS = [
  ["MAT-0231", "AR-88342", "Apto", "Portátil", "Polvo químico ABC", "Ver ficha ↗"],
  ["MAT-0198", "AR-77129", "Observado", "Portátil", "CO₂", "Ver ficha ↗"],
  ["MAT-0056", "AR-55012", "Vencido", "Rodante", "Polvo químico ABC", "Ver ficha ↗"],
  ["MAT-0312", "AR-91004", "En taller", "Portátil", "Agua", "Ver ficha ↗"],
  ["MAT-0044", "AR-40221", "Pendiente", "Vehicular", "CO₂", "Ver ficha ↗"],
];

const REPORTES_ROWS = [
  ["MAT-0198", "AR-77129", "Observado", "15/09/2026", "—", "La Espiga SRL"],
  ["MAT-0312", "AR-91004", "En taller", "—", "10/08/2026", "San Martín SA"],
  ["MAT-0044", "AR-40221", "Pendiente", "02/08/2026", "—", "Colegio San José"],
  ["MAT-0087", "AR-33018", "Apto", "05/08/2026", "—", "Farmacia Central"],
  ["MAT-0119", "AR-60271", "Apto", "—", "12/08/2026", "Los Álamos SRL"],
];

const NOTIFICACIONES_ROWS = [
  ["Certificado emitido", "EMAIL", "Enviada", "compras@laespiga.com.ar", "20/07/2026 16:02"],
  ["Vencimiento próximo", "WHATSAPP", "Entregada", "+54 9 11 5555-1234", "19/07/2026 09:30"],
  ["Unidad retirada", "WHATSAPP", "Entregada", "+54 9 11 4444-7890", "28/07/2026 10:16"],
  ["Mantenimiento atrasado", "EMAIL", "Reintento", "administracion@sanmartinsa.com.ar", "25/07/2026 08:00"],
  ["Orden programada", "EMAIL", "Leída", "compras@laespiga.com.ar", "20/07/2026 09:10"],
];

function MockTable({ columns, rows, statusCol }: { columns: string[]; rows: string[][]; statusCol?: number }) {
  return (
    <div className="mock-table-wrap">
      <table className="mock-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, i) => (
                <td key={i}>
                  {i === statusCol ? <Badge>{cell}</Badge> : i === 0 ? <span className="mock-cell-strong">{cell}</span> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CertificadoDetalle() {
  return (
    <div className="mock-cert">
      <div className="mock-cert-header">
        <span>Emitido el 20/07/2026 · vigente hasta 20/07/2027</span>
      </div>
      <div className="mock-cert-grid">
        <div>
          <span className="mock-cert-label">Tipo</span>
          <span>Certificado de recarga</span>
        </div>
        <div>
          <span className="mock-cert-label">Versión</span>
          <span>v1</span>
        </div>
        <div>
          <span className="mock-cert-label">Responsable técnico</span>
          <span>Lucía Fernández</span>
        </div>
        <div>
          <span className="mock-cert-label">Estado</span>
          <Badge>Emitido</Badge>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <span className="mock-cert-label">Servicios realizados</span>
          <span>Recarga PQS 5kg, Inspección periódica</span>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <span className="mock-cert-label">Verificación pública</span>
          <span className="mock-link">Ver página de verificación ↗</span>
        </div>
      </div>
      <p className="mock-cert-note">
        Los certificados tienen validez legal y no se editan: se anulan o se reemplazan por una nueva versión, dejando rastro.
      </p>
      <div className="mock-cert-actions">
        <span className="mock-btn-secondary">Reemplazar</span>
        <span className="mock-btn-secondary">Anular</span>
      </div>
    </div>
  );
}

function contenidoDeTab(id: string) {
  switch (id) {
    case "clientes":
      return (
        <>
          <p className="mock-subtitle">48 clientes · 126 establecimientos</p>
          <MockTable columns={["Nombre", "CUIT", "Estado", "Condición IVA", "Estab.", "Unidades"]} rows={CLIENTES_ROWS} statusCol={2} />
        </>
      );
    case "matafuegos":
      return (
        <>
          <p className="mock-subtitle">312 unidades · 6 vencen este mes</p>
          <MockTable columns={["Código", "N° serie", "Estado", "Tipo", "Agente", "QR público"]} rows={MATAFUEGOS_ROWS} statusCol={2} />
        </>
      );
    case "certificados":
      return <CertificadoDetalle />;
    case "reportes":
      return (
        <>
          <p className="mock-subtitle">Unidades próximas a vencer · período 01/07 – 31/07 · total 6</p>
          <MockTable
            columns={["Código", "N° serie", "Estado", "Próx. inspección", "Próx. recarga", "Cliente"]}
            rows={REPORTES_ROWS}
            statusCol={2}
          />
        </>
      );
    case "notificaciones":
      return (
        <>
          <p className="mock-subtitle">Avisos automáticos a clientes por email y WhatsApp</p>
          <MockTable columns={["Evento", "Canal", "Estado", "Destinatario", "Fecha"]} rows={NOTIFICACIONES_ROWS} statusCol={2} />
        </>
      );
    default:
      return null;
  }
}

export function MockupCarousel() {
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);
  const tab = TABS[active]!;

  function ir(delta: number) {
    setActive((prev) => (prev + delta + TABS.length) % TABS.length);
  }

  // Avanza solo cada 4.5s (igual que el diseño original), pausado mientras
  // el mouse está sobre el mockup para no interrumpir al que lo está mirando.
  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setActive((prev) => (prev + 1) % TABS.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  function pausar() {
    pausedRef.current = true;
  }
  function reanudar() {
    pausedRef.current = false;
  }

  return (
    <div className="mockup-shell">
      <div className="mockup-window" onMouseEnter={pausar} onMouseLeave={reanudar}>
        <div className="mockup-sidebar">
          <div className="mockup-brand">
            <span className="mockup-brand-mark" />
            <span className="mockup-brand-text">
              <span className="mockup-brand-name">PuntoCo2</span>
              <span className="mockup-brand-slug">matafuegos-del-sur</span>
            </span>
          </div>
          <nav>
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mockup-nav-group">
                <div className="mockup-nav-label">{group.label}</div>
                {group.items.map((item) => (
                  <div key={item} className={`mockup-nav-item${item === tab.sidebarActive ? " active" : ""}`}>
                    {item}
                  </div>
                ))}
              </div>
            ))}
          </nav>
        </div>
        <div className="mockup-content">
          <div className="mockup-content-header">{tab.headerTitle}</div>
          <div className="mockup-content-body" key={tab.id}>
            <h3 className="mock-title">{tab.headerTitle}</h3>
            {contenidoDeTab(tab.id)}
          </div>
        </div>
      </div>

      <div className="mockup-tabbar">
        <div className="mockup-tabbar-pills">
          {TABS.map((t, i) => (
            <button key={t.id} type="button" className={`mockup-pill${i === active ? " active" : ""}`} onClick={() => setActive(i)}>
              {t.tabLabel}
            </button>
          ))}
        </div>
        <div className="mockup-tabbar-arrows">
          <button type="button" className="mockup-arrow" onClick={() => ir(-1)} aria-label="Anterior">
            ←
          </button>
          <button type="button" className="mockup-arrow" onClick={() => ir(1)} aria-label="Siguiente">
            →
          </button>
        </div>
      </div>
    </div>
  );
}

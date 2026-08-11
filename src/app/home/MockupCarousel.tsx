"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneMockup } from "./PhoneMockup";
import { CLIENTES_ROWS, MATAFUEGOS_ROWS, REPORTES_ROWS, NOTIFICACIONES_ROWS, estadoDe } from "./mock-data";

const NAV_GROUPS = [
  { label: "Operación", items: ["Clientes", "Matafuegos", "No conformidades", "Mantenimientos"] },
  { label: "Trabajo", items: ["Órdenes de trabajo", "Retiros y entregas"] },
  { label: "Documentación", items: ["Certificados", "Notificaciones", "Reportes"] },
];

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

// Ancho "natural" del mockup del dashboard: siempre se renderiza con este
// layout fijo (sidebar + tablas completas, sin reflow) y se escala como una
// imagen para caber en pantallas chicas, en vez de reacomodar sus columnas.
const NATURAL_WIDTH = 760;

function useEscalaResponsiva() {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [innerHeight, setInnerHeight] = useState(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    function recalcular() {
      if (!outer || !inner) return;
      setScale(outer.clientWidth / NATURAL_WIDTH);
      setInnerHeight(inner.offsetHeight);
    }

    recalcular();
    const observer = new ResizeObserver(recalcular);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return { outerRef, innerRef, scale, innerHeight };
}

export function MockupCarousel() {
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);
  const tab = TABS[active]!;
  const { outerRef, innerRef, scale, innerHeight } = useEscalaResponsiva();

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
      <div ref={outerRef} className="mockup-scale-outer" style={{ height: scale ? innerHeight * scale : undefined }}>
        <div
          ref={innerRef}
          className="mockup-stack"
          style={{ width: NATURAL_WIDTH, transform: scale ? `scale(${scale})` : undefined, visibility: scale ? "visible" : "hidden" }}
        >
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
          <PhoneMockup activeTab={tab.id} />
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

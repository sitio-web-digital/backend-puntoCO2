"use client";

import { useState } from "react";

interface ReporteDef {
  id: string;
  label: string;
  url: string;
  /** Clave del array a mostrar como tabla; si no se define, se muestra el objeto completo como pares clave/valor. */
  arrayKey?: string;
  soportaFechas?: boolean;
  soportaCsv?: boolean;
}

const REPORTES: ReporteDef[] = [
  { id: "unidades-proximas-a-vencer", label: "Unidades próximas a vencer", url: "/api/reportes/unidades-proximas-a-vencer", arrayKey: "datos", soportaCsv: true },
  { id: "unidades-vencidas", label: "Unidades vencidas", url: "/api/reportes/unidades-vencidas", arrayKey: "datos", soportaCsv: true },
  { id: "inspecciones", label: "Historial de inspecciones", url: "/api/reportes/inspecciones", arrayKey: "datos", soportaFechas: true, soportaCsv: true },
  { id: "mantenimientos", label: "Historial de mantenimientos", url: "/api/reportes/mantenimientos", arrayKey: "datos", soportaFechas: true, soportaCsv: true },
  { id: "ordenes-por-estado", label: "Órdenes por estado", url: "/api/reportes/ordenes-por-estado", arrayKey: "porEstado", soportaFechas: true },
  { id: "unidades-retiradas", label: "Unidades retiradas", url: "/api/reportes/unidades-retiradas", arrayKey: "datos", soportaFechas: true, soportaCsv: true },
  { id: "no-conformidades", label: "Observaciones", url: "/api/reportes/no-conformidades", arrayKey: "datos", soportaFechas: true, soportaCsv: true },
  { id: "certificados", label: "Certificados", url: "/api/reportes/certificados", arrayKey: "datos", soportaFechas: true, soportaCsv: true },
  { id: "notificaciones-fallidas", label: "Notificaciones fallidas", url: "/api/reportes/notificaciones-fallidas", arrayKey: "datos", soportaFechas: true, soportaCsv: true },
  { id: "productividad-por-tecnico", label: "Productividad por técnico", url: "/api/reportes/productividad-por-tecnico", arrayKey: "porTecnico", soportaFechas: true },
  { id: "cobertura-inspecciones", label: "KPI: cobertura de inspecciones", url: "/api/reportes/cobertura-inspecciones", soportaFechas: true },
  { id: "indicadores", label: "Indicadores operativos", url: "/api/reportes/indicadores", soportaFechas: true },
];

function renderCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: unknown }).toNumber === "function") {
    return String((value as { toNumber(): number }).toNumber());
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleString("es-AR");
  }
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ReportesExplorer() {
  const [reporteId, setReporteId] = useState(REPORTES[0]!.id);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [resultado, setResultado] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reporte = REPORTES.find((r) => r.id === reporteId)!;

  function construirUrl(formato?: "csv") {
    const params = new URLSearchParams();
    if (reporte.soportaFechas && desde) params.set("desde", desde);
    if (reporte.soportaFechas && hasta) params.set("hasta", hasta);
    if (formato) params.set("formato", formato);
    const qs = params.toString();
    return qs ? `${reporte.url}?${qs}` : reporte.url;
  }

  async function verReporte() {
    setError(null);
    setLoading(true);
    setResultado(null);
    try {
      const response = await fetch(construirUrl());
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo generar el reporte.");
        return;
      }
      setResultado(data);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  function exportarCsv() {
    window.open(construirUrl("csv"), "_blank");
  }

  const filas = resultado && reporte.arrayKey ? (resultado[reporte.arrayKey] as Record<string, unknown>[] | undefined) : undefined;
  const columnas = filas && filas.length > 0 ? Object.keys(filas[0]!).filter((c) => c !== "tenantId") : [];

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end", gap: 14 }}>
          <div className="field" style={{ marginBottom: 0, flex: 2, minWidth: 230 }}>
            <label htmlFor="reporte">Reporte</label>
            <select id="reporte" value={reporteId} onChange={(e) => setReporteId(e.target.value)}>
              {REPORTES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {reporte.soportaFechas ? (
            <>
              <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
                <label htmlFor="desde">Desde</label>
                <input id="desde" type="date" className="mono" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
                <label htmlFor="hasta">Hasta</label>
                <input id="hasta" type="date" className="mono" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
            </>
          ) : null}
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn-primary" onClick={verReporte} disabled={loading}>
              {loading ? "Generando..." : "Ver reporte"}
            </button>
            {reporte.soportaCsv ? (
              <button type="button" className="btn-secondary" onClick={exportarCsv}>
                Exportar CSV
              </button>
            ) : null}
          </div>
        </div>
        {error ? (
          <p className="error" style={{ marginTop: 12 }}>
            {error}
          </p>
        ) : null}
      </div>

      {resultado ? (
        <div className="card" style={{ padding: 0 }}>
          {filas ? (
            filas.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>
                El período seleccionado no tiene datos para este reporte.
              </p>
            ) : (
              <>
                <div className="row-between" style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                  <h2>{reporte.label}</h2>
                  {"total" in resultado ? (
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                      Total: {String(resultado.total)}
                    </span>
                  ) : null}
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        {columnas.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((fila, i) => (
                        <tr key={i}>
                          {columnas.map((c) => (
                            <td key={c} className="mono">
                              {renderCell(fila[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          ) : (
            <table>
              <tbody>
                {Object.entries(resultado)
                  .filter(([key]) => key !== "filtros")
                  .map(([key, value]) => (
                    <tr key={key}>
                      <th style={{ width: 260 }}>{key}</th>
                      <td className="mono">{typeof value === "object" && value !== null ? JSON.stringify(value) : renderCell(value)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}

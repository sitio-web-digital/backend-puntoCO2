"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Drawer } from "../_components/Drawer";

interface ResumenImport {
  creados: number;
  conError: number;
  detalle: { fila: number; ok: boolean; mensaje?: string }[];
}

export function ImportarClientesButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenImport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setError(null);
    setResumen(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Elegí un archivo .xlsx primero.");
      return;
    }

    setError(null);
    setResumen(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("archivo", file);
      const response = await fetch("/api/clientes/importar", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo importar el archivo.");
        return;
      }
      setResumen(data);
      if (data.creados > 0) router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Importar Excel
      </button>

      <Drawer title="Importar clientes desde Excel" open={open} onClose={() => setOpen(false)}>
        <div className="stack" style={{ gap: 14 }}>
          <div className="stack" style={{ gap: 8 }}>
            <p className="muted" style={{ margin: 0 }}>
              Cada fila del archivo da de alta un cliente nuevo (misma validación que el alta manual). No actualiza clientes existentes: si
              el CUIT ya está cargado, esa fila se reporta como error.
            </p>
            {/* Descarga de archivo (Content-Disposition: attachment), no navegación entre páginas: <a> nativo es lo correcto acá. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/clientes/importar/plantilla" className="btn-secondary btn-sm" style={{ width: "fit-content" }}>
              Descargar plantilla .xlsx
            </a>
          </div>

          <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="archivo">Archivo .xlsx</label>
              <input id="archivo" ref={fileInputRef} type="file" accept=".xlsx" required />
            </div>

            {error ? <p className="error">{error}</p> : null}

            <div>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Importando..." : "Importar"}
              </button>
            </div>
          </form>

          {resumen ? (
            <div className="stack" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <span className="badge badge-success">{resumen.creados} creados</span>
                {resumen.conError > 0 ? <span className="badge badge-danger">{resumen.conError} con error</span> : null}
              </div>
              {resumen.conError > 0 ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Fila</th>
                        <th>Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumen.detalle
                        .filter((d) => !d.ok)
                        .map((d) => (
                          <tr key={d.fila}>
                            <td className="mono">{d.fila}</td>
                            <td style={{ color: "var(--bad)", fontSize: 13 }}>{d.mensaje}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Drawer>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../../_components/Drawer";

const TIPOS = ["PORTATIL", "RODANTE", "VEHICULAR", "OTRO"];
const AGENTES = ["POLVO_QUIMICO_ABC", "CO2", "AGUA", "ESPUMA", "AGENTE_LIMPIO", "OTRO"];

export interface MatafuegoEditable {
  id: string;
  codigoInterno: string;
  numeroSerie: string;
  codigoBarras: string | null;
  tipo: string;
  agenteExtintor: string;
  capacidadNominal: string | null;
  marca: string | null;
  modelo: string | null;
  fabricante: string | null;
  fechaFabricacion: Date | null;
  fechaPuestaServicio: Date | null;
  pesoNominal: number | null;
  normaTecnica: string | null;
  observaciones: string | null;
}

function fechaInput(fecha: Date | null): string {
  if (!fecha) return "";
  return new Date(fecha).toISOString().slice(0, 10);
}

export function EditarMatafuegoForm({ matafuego, size = "md" }: { matafuego: MatafuegoEditable; size?: "md" | "sm" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string" || value.trim() === "") continue;
      body[key] = key === "pesoNominal" ? Number(value) : value.trim();
    }

    try {
      const response = await fetch(`/api/matafuegos/${matafuego.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo guardar los cambios.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className={size === "sm" ? "btn-secondary btn-sm" : "btn-secondary"} onClick={() => setOpen(true)}>
        Editar
      </button>

      <Drawer title="Editar matafuego" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="codigoInterno">Código interno</label>
              <input id="codigoInterno" name="codigoInterno" className="mono" defaultValue={matafuego.codigoInterno} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="numeroSerie">N° de serie</label>
              <input id="numeroSerie" name="numeroSerie" className="mono" defaultValue={matafuego.numeroSerie} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="codigoBarras">Código de barras</label>
              <input id="codigoBarras" name="codigoBarras" className="mono" defaultValue={matafuego.codigoBarras ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="tipo">Tipo</label>
              <select id="tipo" name="tipo" defaultValue={matafuego.tipo} required>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="agenteExtintor">Agente extintor</label>
              <select id="agenteExtintor" name="agenteExtintor" defaultValue={matafuego.agenteExtintor} required>
                {AGENTES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="capacidadNominal">Capacidad nominal</label>
              <input id="capacidadNominal" name="capacidadNominal" defaultValue={matafuego.capacidadNominal ?? ""} placeholder="5kg" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="marca">Marca</label>
              <input id="marca" name="marca" defaultValue={matafuego.marca ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="modelo">Modelo</label>
              <input id="modelo" name="modelo" defaultValue={matafuego.modelo ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="fabricante">Fabricante</label>
              <input id="fabricante" name="fabricante" defaultValue={matafuego.fabricante ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="pesoNominal">Peso nominal (kg)</label>
              <input
                id="pesoNominal"
                name="pesoNominal"
                type="number"
                step="0.01"
                min="0"
                className="mono"
                defaultValue={matafuego.pesoNominal ?? ""}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="fechaFabricacion">Fecha de fabricación</label>
              <input id="fechaFabricacion" name="fechaFabricacion" type="date" className="mono" defaultValue={fechaInput(matafuego.fechaFabricacion)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="fechaPuestaServicio">Fecha de puesta en servicio</label>
              <input
                id="fechaPuestaServicio"
                name="fechaPuestaServicio"
                type="date"
                className="mono"
                defaultValue={fechaInput(matafuego.fechaPuestaServicio)}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="normaTecnica">Norma técnica</label>
              <input id="normaTecnica" name="normaTecnica" defaultValue={matafuego.normaTecnica ?? ""} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="observaciones">Observaciones</label>
            <textarea id="observaciones" name="observaciones" rows={3} defaultValue={matafuego.observaciones ?? ""} />
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../../_components/Drawer";

const SEVERIDADES = ["BAJA", "MEDIA", "ALTA", "CRITICA"];
const NIVELES_RIESGO = ["BAJO", "MEDIO", "ALTO", "CRITICO"];

export function NuevaNoConformidadForm({ matafuegoId }: { matafuegoId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setLoading(true);

    const formData = new FormData(form);
    const body: Record<string, unknown> = { reinspeccionRequerida: formData.get("reinspeccionRequerida") === "on" };
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value.trim() !== "" && key !== "reinspeccionRequerida") body[key] = value.trim();
    }

    try {
      const response = await fetch(`/api/matafuegos/${matafuegoId}/no-conformidades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo registrar la observación.");
        return;
      }
      setOpen(false);
      form.reset();
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
        + Observación
      </button>

      <Drawer title="Nueva observación" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="tipoDefecto">Tipo de defecto</label>
            <input id="tipoDefecto" name="tipoDefecto" placeholder="Ej: Manómetro fuera de rango" required maxLength={150} />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="descripcion">Descripción</label>
            <textarea id="descripcion" name="descripcion" rows={3} required maxLength={2000} />
          </div>

          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="severidad">Severidad</label>
              <select id="severidad" name="severidad" required defaultValue="">
                <option value="" disabled>
                  Seleccionar...
                </option>
                {SEVERIDADES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="nivelRiesgo">Nivel de riesgo</label>
              <select id="nivelRiesgo" name="nivelRiesgo" required defaultValue="">
                <option value="" disabled>
                  Seleccionar...
                </option>
                {NIVELES_RIESGO.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="fechaLimite">Fecha límite (opcional)</label>
              <input id="fechaLimite" name="fechaLimite" type="date" className="mono" />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="accionInmediata">Acción inmediata (opcional)</label>
            <textarea id="accionInmediata" name="accionInmediata" rows={2} maxLength={1000} />
          </div>

          <label className="checkbox-pill" style={{ width: "fit-content" }}>
            <input id="reinspeccionRequerida" name="reinspeccionRequerida" type="checkbox" />
            Requiere reinspección
          </label>

          {error ? <p className="error">{error}</p> : null}

          <div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Guardando..." : "Guardar observación"}
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

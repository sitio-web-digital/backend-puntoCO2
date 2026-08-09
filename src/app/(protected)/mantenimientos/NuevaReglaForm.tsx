"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Drawer } from "../_components/Drawer";

const TIPOS_SERVICIO = ["INSPECCION", "MANTENIMIENTO", "RECARGA", "PRUEBA_HIDRAULICA", "CAMBIO_AGENTE", "REPARACION", "RETIRO_ENTREGA", "OTRO"];
const TIPOS_MATAFUEGO = ["PORTATIL", "RODANTE", "VEHICULAR", "OTRO"];
const AGENTES = ["POLVO_QUIMICO_ABC", "CO2", "AGUA", "ESPUMA", "AGENTE_LIMPIO", "OTRO"];

/**
 * Encabezado del card "Reglas de mantenimiento": título + contador +
 * descripción + botón que abre el drawer del formulario (mismo patrón que
 * EstablecimientosHeader en clientes/[id]/NuevoEstablecimientoForm.tsx).
 */
export function ReglasHeader({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <div className="row-between" style={{ flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
          <div className="row" style={{ gap: 10, alignItems: "baseline" }}>
            <h2>Reglas de mantenimiento</h2>
            <span className="mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
              {count}
            </span>
          </div>
          <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
            + Nueva regla
          </button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Definen cada cuántos meses corresponde cada tipo de servicio, opcionalmente acotado a un cliente, tipo de unidad o agente
          extintor.
        </p>
      </div>

      <NuevaReglaForm open={open} onClose={() => setOpen(false)} />

      {children}
    </>
  );
}

function NuevaReglaForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setLoading(true);

    const formData = new FormData(form);
    const body: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string" || value.trim() === "") continue;
      body[key] = key === "frecuenciaMeses" ? Number(value) : value;
    }

    try {
      const response = await fetch("/api/reglas-mantenimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo crear la regla.");
        return;
      }
      onClose();
      form.reset();
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer title="Nueva regla" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
        <div className="grid2">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="tipoServicio">Tipo de servicio</label>
            <select id="tipoServicio" name="tipoServicio" required defaultValue="">
              <option value="" disabled>
                Seleccionar...
              </option>
              {TIPOS_SERVICIO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="frecuenciaMeses">Frecuencia (meses)</label>
            <input id="frecuenciaMeses" name="frecuenciaMeses" type="number" min={1} max={120} required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="tipoMatafuego">Tipo de unidad (opcional)</label>
            <select id="tipoMatafuego" name="tipoMatafuego" defaultValue="">
              <option value="">Cualquiera</option>
              {TIPOS_MATAFUEGO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="agenteExtintor">Agente extintor (opcional)</label>
            <select id="agenteExtintor" name="agenteExtintor" defaultValue="">
              <option value="">Cualquiera</option>
              {AGENTES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="descripcion">Descripción</label>
          <input id="descripcion" name="descripcion" />
        </div>

        {error ? <p className="error">{error}</p> : null}

        <div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Guardando..." : "Guardar regla"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function IngresarTallerForm({ id }: { id: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [personaQueRecibe, setPersonaQueRecibe] = useState("");
  const [ubicacionInterna, setUbicacionInterna] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!personaQueRecibe.trim()) {
      setError("Indicá quién recibe la unidad.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/retiros-entregas/${id}/ingresar-taller`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaQueRecibe, ...(ubicacionInterna ? { ubicacionInterna } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo registrar el ingreso a taller.");
        return;
      }
      setAbierto(false);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (!abierto) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setAbierto(true)}>
        Ingresar a taller
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 14, minWidth: 260 }}>
      <div className="stack" style={{ gap: 8 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="personaQueRecibe">Persona que recibe</label>
          <input id="personaQueRecibe" value={personaQueRecibe} onChange={(e) => setPersonaQueRecibe(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="ubicacionInterna">Ubicación interna (opcional)</label>
          <input id="ubicacionInterna" className="mono" value={ubicacionInterna} onChange={(e) => setUbicacionInterna(e.target.value)} />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "..." : "Confirmar"}
          </button>
          <button type="button" className="btn-link" onClick={() => setAbierto(false)}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

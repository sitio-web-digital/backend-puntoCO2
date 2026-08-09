"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ActualizarUbicacionForm({ id }: { id: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [ubicacionInterna, setUbicacionInterna] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!ubicacionInterna.trim()) {
      setError("Indicá la nueva ubicación.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/retiros-entregas/${id}/ubicacion-interna`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ubicacionInterna }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo actualizar la ubicación.");
        return;
      }
      setAbierto(false);
      setUbicacionInterna("");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (!abierto) {
    return (
      <button type="button" className="btn-secondary" title="Cambiar ubicación interna" onClick={() => setAbierto(true)}>
        Ubicación
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 14, minWidth: 240 }}>
      <div className="stack" style={{ gap: 8 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="ubicacionInterna">Nueva ubicación</label>
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

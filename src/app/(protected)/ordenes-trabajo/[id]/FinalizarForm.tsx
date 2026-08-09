"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FinalizarForm({ ordenId }: { ordenId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [resultadoTecnico, setResultadoTecnico] = useState("");
  const [horasTrabajadas, setHorasTrabajadas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!resultadoTecnico.trim()) {
      setError("Describí el resultado técnico.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/ordenes-trabajo/${ordenId}/finalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultadoTecnico, ...(horasTrabajadas ? { horasTrabajadas: Number(horasTrabajadas) } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo finalizar la orden.");
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
      <button type="button" className="btn-primary" onClick={() => setAbierto(true)}>
        Finalizar
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 14, minWidth: 280 }}>
      <div className="stack" style={{ gap: 8 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="resultadoTecnico">Resultado técnico</label>
          <textarea id="resultadoTecnico" rows={3} value={resultadoTecnico} onChange={(e) => setResultadoTecnico(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="horasTrabajadas">Horas trabajadas (opcional)</label>
          <input
            id="horasTrabajadas"
            type="number"
            min={0}
            step="0.5"
            className="mono"
            value={horasTrabajadas}
            onChange={(e) => setHorasTrabajadas(e.target.value)}
          />
        </div>
        {error ? <span className="error">{error}</span> : null}
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn-primary btn-sm" onClick={handleSubmit} disabled={loading}>
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

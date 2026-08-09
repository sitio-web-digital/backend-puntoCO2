"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AsignarTecnicoForm({ ordenId, tecnicos }: { ordenId: string; tecnicos: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tecnicoAsignadoId, setTecnicoAsignadoId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!tecnicoAsignadoId) {
      setError("Elegí un técnico.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/ordenes-trabajo/${ordenId}/asignar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tecnicoAsignadoId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo asignar el técnico.");
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
        Asignar técnico
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 14, minWidth: 240 }}>
      <div className="stack" style={{ gap: 8 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="tecnicoAsignadoId">Técnico</label>
          <select id="tecnicoAsignadoId" value={tecnicoAsignadoId} onChange={(e) => setTecnicoAsignadoId(e.target.value)}>
            <option value="">Seleccionar...</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
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

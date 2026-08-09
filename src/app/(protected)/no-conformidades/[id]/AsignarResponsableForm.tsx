"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AsignarResponsableForm({ id, usuarios }: { id: string; usuarios: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [responsableId, setResponsableId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!responsableId) {
      setError("Elegí un responsable.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/no-conformidades/${id}/asignar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsableId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo asignar el responsable.");
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
        Asignar responsable
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 12, minWidth: 240 }}>
      <div className="field" style={{ marginBottom: 8 }}>
        <label htmlFor="responsableId">Responsable</label>
        <select id="responsableId" value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
          <option value="">Seleccionar...</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="row">
        <button type="button" className="btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "..." : "Confirmar"}
        </button>
        <button type="button" className="btn-link" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

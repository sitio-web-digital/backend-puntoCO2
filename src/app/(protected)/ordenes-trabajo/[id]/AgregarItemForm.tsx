"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AgregarItemForm({ ordenId, servicios }: { ordenId: string; servicios: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [servicioId, setServicioId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!servicioId) {
      setError("Elegí un servicio.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/ordenes-trabajo/${ordenId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servicioId, cantidad }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo agregar el ítem.");
        return;
      }
      setServicioId("");
      setCantidad(1);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
      <div className="field" style={{ marginBottom: 0, flex: 2, minWidth: 200 }}>
        <label htmlFor="servicioId">Servicio</label>
        <select id="servicioId" value={servicioId} onChange={(e) => setServicioId(e.target.value)}>
          <option value="">Seleccionar...</option>
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="field" style={{ marginBottom: 0, width: 90 }}>
        <label htmlFor="cantidad">Cantidad</label>
        <input id="cantidad" type="number" min={1} className="mono" value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} />
      </div>
      <button type="button" className="btn-secondary" onClick={handleSubmit} disabled={loading}>
        {loading ? "..." : "+ Agregar"}
      </button>
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}

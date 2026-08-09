"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function RegistrarAvanceForm({ ordenId }: { ordenId: string }) {
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
      body[key] = key === "horasTrabajadas" ? Number(value) : value;
    }

    try {
      const response = await fetch(`/api/ordenes-trabajo/${ordenId}/avance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo registrar el avance.");
        return;
      }
      form.reset();
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
      <div className="grid2">
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="horasTrabajadas">Horas trabajadas</label>
          <input id="horasTrabajadas" name="horasTrabajadas" type="number" min={0} step="0.5" className="mono" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="repuestosUtilizados">Repuestos utilizados</label>
          <input id="repuestosUtilizados" name="repuestosUtilizados" />
        </div>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="observaciones">Observaciones</label>
        <textarea id="observaciones" name="observaciones" rows={2} />
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div>
        <button type="submit" className="btn-secondary" disabled={loading}>
          {loading ? "Guardando..." : "Guardar avance"}
        </button>
      </div>
    </form>
  );
}

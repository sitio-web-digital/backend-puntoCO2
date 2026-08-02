"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function NuevoEstablecimientoForm({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const body: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value.trim() !== "") body[key] = value;
    }

    try {
      const response = await fetch(`/api/clientes/${clienteId}/establecimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo crear el establecimiento.");
        return;
      }
      setAbierto(false);
      event.currentTarget.reset();
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
        + Nuevo establecimiento
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="stack" style={{ gap: 0 }}>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <strong>Nuevo establecimiento</strong>
        <button type="button" className="btn-link" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
      </div>

      <div className="field">
        <label htmlFor="nombre">Nombre / identificación de la sede</label>
        <input id="nombre" name="nombre" required />
      </div>

      <div className="row">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="direccion">Dirección</label>
          <input id="direccion" name="direccion" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="provincia">Provincia</label>
          <input id="provincia" name="provincia" />
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? "Guardando..." : "Guardar establecimiento"}
      </button>
    </form>
  );
}

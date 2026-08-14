"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResolverForm({ id }: { id: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [resolucion, setResolucion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!resolucion.trim()) {
      setError("Describí cómo se resolvió.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/no-conformidades/${id}/resolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolucion }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo resolver la observación.");
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
        Resolver
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 12, minWidth: 260 }}>
      <div className="field" style={{ marginBottom: 8 }}>
        <label htmlFor="resolucion">Resolución</label>
        <textarea id="resolucion" rows={3} value={resolucion} onChange={(e) => setResolucion(e.target.value)} />
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

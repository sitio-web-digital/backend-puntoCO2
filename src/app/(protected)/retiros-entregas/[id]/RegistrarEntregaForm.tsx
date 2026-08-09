"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegistrarEntregaForm({ id }: { id: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [personaQueRecibe, setPersonaQueRecibe] = useState("");
  const [firmaRecepcionNombre, setFirmaRecepcionNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!personaQueRecibe.trim() || !firmaRecepcionNombre.trim()) {
      setError("Completá quién recibe y el nombre de la firma de recepción.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/retiros-entregas/${id}/entregar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaQueRecibe, firmaRecepcionNombre }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo registrar la entrega.");
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
        Registrar entrega
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 14, minWidth: 280 }}>
      <div className="stack" style={{ gap: 8 }}>
        <p className="muted" style={{ margin: 0 }}>
          Todavía no hay captura de firma real (requiere gestión de archivos) — se registra el nombre de quien firma.
        </p>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="personaQueRecibe">Persona que recibe</label>
          <input id="personaQueRecibe" value={personaQueRecibe} onChange={(e) => setPersonaQueRecibe(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="firmaRecepcionNombre">Firma de recepción (nombre)</label>
          <input id="firmaRecepcionNombre" value={firmaRecepcionNombre} onChange={(e) => setFirmaRecepcionNombre(e.target.value)} />
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

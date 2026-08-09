"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReemplazarCertificadoForm({ id }: { id: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!motivo.trim()) {
      setError("El motivo del reemplazo es obligatorio.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/certificados/${id}/reemplazar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo reemplazar el certificado.");
        return;
      }
      router.push(`/certificados/${data.nuevo.id}`);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (!abierto) {
    return (
      <button type="button" className="btn-secondary" title="Reemplazar (nueva versión)" onClick={() => setAbierto(true)}>
        Reemplazar
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 12, minWidth: 280 }}>
      <div className="field" style={{ marginBottom: 8 }}>
        <label htmlFor="motivo">Motivo del reemplazo</label>
        <textarea id="motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
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

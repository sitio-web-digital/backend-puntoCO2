"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function EditarWhatsappForm({ tenantId, valorActual }: { tenantId: string; valorActual: string | null }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(valorActual ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/platform/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappFromNumber: valor.trim() || null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message ?? "No se pudo guardar el número.");
        return;
      }
      setEditando(false);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (!editando) {
    return (
      <div>
        <label>Remitente de WhatsApp (Twilio)</label>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <span className="mono" style={{ fontSize: 14.5 }}>
            {valorActual ?? "No configurado"}
          </span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setEditando(true)}>
            Editar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="whatsappFromNumber">Remitente de WhatsApp (Twilio)</label>
      <form onSubmit={handleSubmit} className="row" style={{ gap: 8, alignItems: "flex-start" }}>
        <input
          id="whatsappFromNumber"
          name="whatsappFromNumber"
          className="mono"
          placeholder="+5491155551234"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          style={{ maxWidth: 220 }}
        />
        <button type="submit" className="btn-primary btn-sm" disabled={loading}>
          {loading ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => {
            setEditando(false);
            setValor(valorActual ?? "");
            setError(null);
          }}
        >
          Cancelar
        </button>
      </form>
      {error ? (
        <p className="error" style={{ marginTop: 4 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

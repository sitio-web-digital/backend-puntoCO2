"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ResponderTicketPlataformaForm({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const cuerpo = String(formData.get("cuerpo") ?? "").trim();
    if (!cuerpo) {
      setError("Escribí un mensaje.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/platform/tickets/${id}/mensajes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuerpo }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo enviar el mensaje.");
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
    <form onSubmit={handleSubmit} className="stack" style={{ gap: 10 }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="cuerpo">Responder como Matafuego SaaS</label>
        <textarea id="cuerpo" name="cuerpo" rows={3} placeholder="Escribí tu respuesta..." required maxLength={5000} />
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Enviando..." : "Enviar"}
        </button>
      </div>
    </form>
  );
}

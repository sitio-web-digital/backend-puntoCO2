"use client";

import { useState, type FormEvent } from "react";

export function WaitlistForm({ ctaLabel, helperText, dark = false }: { ctaLabel: string; helperText?: string; dark?: boolean }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.message ?? "No se pudo anotar el email.");
        return;
      }
      setEnviado(true);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (enviado) {
    return <p className={`waitlist-confirm${dark ? " dark" : ""}`}>¡Listo! Te avisamos por mail cuando abramos el acceso.</p>;
  }

  return (
    <div className="stack" style={{ gap: 10, maxWidth: 520 }}>
      <form onSubmit={handleSubmit} className="waitlist-form">
        <input
          type="email"
          required
          placeholder="tucorreo@empresa.com.ar"
          aria-label="Tu correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="waitlist-input"
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Enviando..." : ctaLabel}
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {helperText ? <span className={`waitlist-helper${dark ? " dark" : ""}`}>{helperText}</span> : null}
    </div>
  );
}

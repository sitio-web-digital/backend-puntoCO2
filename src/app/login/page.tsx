"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo iniciar sesión.");
        return;
      }
      router.push("/clientes");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-brand-panel">
        <div className="row" style={{ gap: 11 }}>
          <div className="auth-brand-mark">M</div>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em" }}>Matafuego SaaS</span>
        </div>

        <div className="auth-brand-pitch">
          <h1>Gestión integral de matafuegos.</h1>
          <p>Inspección, mantenimiento, certificación y facturación en un solo lugar, con trazabilidad de punta a punta.</p>
          <div className="auth-brand-features">
            <span>Inspección con QR en campo</span>
            <span>Órdenes de trabajo y cadena de custodia</span>
            <span>Certificados con validez IRAM</span>
          </div>
        </div>

        <span className="auth-brand-version">v1.0 · Argentina</span>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-panel-inner">
          <div className="stack" style={{ gap: 7 }}>
            <h1 style={{ fontSize: 23 }}>Ingresar</h1>
            <p className="muted">Accedé con la cuenta de tu empresa.</p>
          </div>

          <form onSubmit={handleSubmit} className="stack" style={{ gap: 15 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="slug">Empresa (identificador)</label>
              <input
                id="slug"
                className="mono"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="demo"
                required
                autoComplete="organization"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error ? <p className="error">{error}</p> : null}

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%", marginTop: 4 }}>
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          <div className="auth-hint">
            <p className="muted" style={{ margin: 0 }}>
              ¿Sos cliente y querés consultar el estado de tu matafuego? No necesitás cuenta: escaneá el código QR de la etiqueta.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

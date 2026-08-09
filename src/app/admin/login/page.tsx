"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Sin "slug": el propio login-service interpreta la ausencia de empresa
      // como un intento de acceso del Superadministrador de la plataforma.
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo iniciar sesión.");
        return;
      }
      router.push("/admin");
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
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em" }}>Matafuego SaaS · Plataforma</span>
        </div>

        <div className="auth-brand-pitch">
          <h1>Panel de la plataforma.</h1>
          <p>Empresas dadas de alta, estado de cada suscripción y soporte — visión de todo el negocio, no de una empresa en particular.</p>
          <div className="auth-brand-features">
            <span>Alta y estado de empresas clientes</span>
            <span>Indicadores agregados de uso</span>
            <span>Tickets de soporte</span>
          </div>
        </div>

        <span className="auth-brand-version">v1.0 · Argentina</span>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-panel-inner">
          <div className="stack" style={{ gap: 7 }}>
            <h1 style={{ fontSize: 23 }}>Acceso de plataforma</h1>
            <p className="muted">Sólo para el equipo de Matafuego SaaS. Si sos de una empresa cliente, entrá desde el login normal.</p>
          </div>

          <form onSubmit={handleSubmit} className="stack" style={{ gap: 15 }}>
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
        </div>
      </div>
    </main>
  );
}

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
    <main className="login-shell">
      <div className="card login-card stack">
        <div className="stack" style={{ gap: 4 }}>
          <h1>Matafuego SaaS</h1>
          <p className="muted">Ingresá con tu cuenta de empresa.</p>
        </div>

        <form onSubmit={handleSubmit} className="stack" style={{ gap: 0 }}>
          <div className="field">
            <label htmlFor="slug">Empresa</label>
            <input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="demo" required autoComplete="organization" />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </div>
          <div className="field">
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

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </main>
  );
}

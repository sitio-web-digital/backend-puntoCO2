"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "@/app/(protected)/_components/Drawer";

export function NuevaEmpresaForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creada, setCreada] = useState<{ slug: string; adminEmail: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string" || value.trim() === "") continue;
      body[key] = key === "trialDias" ? Number(value) : value.trim();
    }

    try {
      const response = await fetch("/api/platform/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        if (Array.isArray(data.details) && data.details.length > 0) {
          setError(data.details.map((d: { path: (string | number)[]; message: string }) => `${d.path.join(".")}: ${d.message}`).join(" · "));
        } else {
          setError(data.message ?? "No se pudo crear la empresa.");
        }
        return;
      }
      setCreada({ slug: data.tenant.slug, adminEmail: data.usuarioAdmin.email });
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  function cerrar() {
    setOpen(false);
    setCreada(null);
  }

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + Nueva empresa
      </button>

      <Drawer title="Nueva empresa" open={open} onClose={cerrar}>
        {creada ? (
          <div className="stack" style={{ gap: 16 }}>
            <div className="card stack" style={{ gap: 8 }}>
              <span className="badge badge-success" style={{ width: "fit-content" }}>
                Empresa creada
              </span>
              <p style={{ margin: 0, fontSize: 13.5 }}>
                Identificador: <span className="mono">{creada.slug}</span>
              </p>
              <p style={{ margin: 0, fontSize: 13.5 }}>
                Admin: <span className="mono">{creada.adminEmail}</span>
              </p>
              <p className="muted" style={{ margin: 0 }}>
                Compartile a la empresa el identificador y la contraseña inicial que definiste para que puedan entrar.
              </p>
            </div>
            <div>
              <button type="button" className="btn-secondary" onClick={cerrar}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="nombre">Nombre de la empresa</label>
              <input id="nombre" name="nombre" placeholder="Ej: Matafuegos del Sur SRL" required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="slug">Identificador (slug)</label>
              <input
                id="slug"
                name="slug"
                className="mono"
                placeholder="matafuegos-del-sur"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                minLength={3}
                title="Sólo minúsculas, números y guiones, sin espacios (ej: acme-matafuegos)"
                required
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="cuit">CUIT (opcional)</label>
              <input id="cuit" name="cuit" className="mono" placeholder="30-71234567-8" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="trialDias">Días de prueba</label>
              <input id="trialDias" name="trialDias" type="number" min={1} max={365} className="mono" defaultValue={14} required />
            </div>

            <div className="grid2" style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="adminNombre">Nombre del administrador</label>
                <input id="adminNombre" name="adminNombre" required />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="adminApellido">Apellido del administrador</label>
                <input id="adminApellido" name="adminApellido" required />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="adminEmail">Email del administrador</label>
                <input id="adminEmail" name="adminEmail" type="email" required />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="adminPassword">Contraseña inicial</label>
                <input id="adminPassword" name="adminPassword" placeholder="Mínimo 12 caracteres" minLength={12} required />
              </div>
            </div>

            {error ? <p className="error">{error}</p> : null}

            <div>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Creando..." : "Crear empresa"}
              </button>
            </div>
          </form>
        )}
      </Drawer>
    </>
  );
}

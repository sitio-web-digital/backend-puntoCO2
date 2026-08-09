"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../_components/Drawer";

interface RolOption {
  id: string;
  nombre: string;
}

export function NuevoUsuarioForm({ roles }: { roles: RolOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rolIds, setRolIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleRol(id: string) {
    setRolIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);

    if (rolIds.length === 0) {
      setError("Seleccioná al menos un rol.");
      return;
    }
    setLoading(true);

    const formData = new FormData(form);
    const body = {
      email: formData.get("email"),
      password: formData.get("password"),
      nombre: formData.get("nombre"),
      apellido: formData.get("apellido"),
      rolIds,
    };

    try {
      const response = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo crear el usuario.");
        return;
      }
      setOpen(false);
      setRolIds([]);
      form.reset();
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + Nuevo usuario
      </button>

      <Drawer title="Nuevo usuario" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 18 }}>
          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" placeholder="Ej: Lucía" required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="apellido">Apellido</label>
              <input id="apellido" name="apellido" placeholder="Ej: Fernández" required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="password">Contraseña inicial</label>
              <input id="password" name="password" type="text" minLength={12} required placeholder="Mínimo 12 caracteres" />
            </div>
          </div>

          <div>
            <span style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-3)", fontFamily: "var(--font-mono)", marginBottom: 10 }}>
              Roles
            </span>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              {roles.map((rol) => (
                <label key={rol.id} className="checkbox-pill">
                  <input type="checkbox" checked={rolIds.includes(rol.id)} onChange={() => toggleRol(rol.id)} />
                  {rol.nombre}
                </label>
              ))}
            </div>
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div>
            <button type="submit" className="btn-primary" title="Guardar usuario" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

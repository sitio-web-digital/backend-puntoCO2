"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../_components/Drawer";

export interface UsuarioEditable {
  id: string;
  nombre: string;
  apellido: string;
}

export function EditarUsuarioForm({ usuario }: { usuario: UsuarioEditable }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const body: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") body[key] = value.trim();
    }

    try {
      const response = await fetch(`/api/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo guardar los cambios.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
        Editar
      </button>

      <Drawer title="Editar usuario" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" defaultValue={usuario.nombre} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="apellido">Apellido</label>
              <input id="apellido" name="apellido" defaultValue={usuario.apellido} required />
            </div>
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

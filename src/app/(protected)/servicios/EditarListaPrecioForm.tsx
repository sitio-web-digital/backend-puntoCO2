"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../_components/Drawer";

export interface ListaPrecioEditable {
  id: string;
  nombre: string;
  descripcion: string | null;
  esPredeterminada: boolean;
}

export function EditarListaPrecioForm({ lista }: { lista: ListaPrecioEditable }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const body: Record<string, unknown> = { esPredeterminada: formData.get("esPredeterminada") === "on" };
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && key !== "esPredeterminada") body[key] = value.trim();
    }

    try {
      const response = await fetch(`/api/listas-precio/${lista.id}`, {
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

      <Drawer title="Editar lista de precios" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" defaultValue={lista.nombre} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="descripcion">Descripción</label>
              <input id="descripcion" name="descripcion" defaultValue={lista.descripcion ?? ""} />
            </div>
          </div>

          <label className="checkbox-pill" style={{ width: "fit-content" }}>
            <input id="esPredeterminada" name="esPredeterminada" type="checkbox" defaultChecked={lista.esPredeterminada} />
            Usar como lista predeterminada
          </label>

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

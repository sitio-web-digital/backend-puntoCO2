"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../_components/Drawer";

export function NuevaListaPrecioForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setLoading(true);

    const formData = new FormData(form);
    const body: Record<string, unknown> = { esPredeterminada: formData.get("esPredeterminada") === "on" };
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value.trim() !== "" && key !== "esPredeterminada") body[key] = value;
    }

    try {
      const response = await fetch("/api/listas-precio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo crear la lista de precios.");
        return;
      }
      setOpen(false);
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
        + Nueva lista de precios
      </button>

      <Drawer title="Nueva lista de precios" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="descripcion">Descripción</label>
              <input id="descripcion" name="descripcion" />
            </div>
          </div>

          <label className="checkbox-pill" style={{ width: "fit-content" }}>
            <input id="esPredeterminada" name="esPredeterminada" type="checkbox" />
            Usar como lista predeterminada
          </label>

          {error ? <p className="error">{error}</p> : null}

          <div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Guardando..." : "Guardar lista"}
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

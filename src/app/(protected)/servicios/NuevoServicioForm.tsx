"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../_components/Drawer";

const CATEGORIAS = [
  "RECARGA",
  "PRUEBA_HIDRAULICA",
  "PINTURA",
  "REPARACION",
  "CAMBIO_AGENTE",
  "INSPECCION",
  "MANTENIMIENTO",
  "REEMPLAZO_REPUESTOS",
  "VENTA",
  "INSTALACION",
  "RETIRO_ENTREGA",
  "OTRO",
];

export function NuevoServicioForm() {
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
    const body: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string" || value.trim() === "") continue;
      body[key] = ["precioBase", "costoEstimado"].includes(key) ? Number(value) : value;
    }

    try {
      const response = await fetch("/api/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo crear el servicio.");
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
        + Nuevo servicio
      </button>

      <Drawer title="Nuevo servicio" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="codigo">Código</label>
              <input id="codigo" name="codigo" className="mono" required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" required />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="categoria">Categoría</label>
            <select id="categoria" name="categoria" required defaultValue="">
              <option value="" disabled>
                Seleccionar...
              </option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="precioBase">Precio base ($)</label>
              <input id="precioBase" name="precioBase" type="number" min={0} step="0.01" required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="costoEstimado">Costo estimado ($, opcional)</label>
              <input id="costoEstimado" name="costoEstimado" type="number" min={0} step="0.01" />
            </div>
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Guardando..." : "Guardar servicio"}
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

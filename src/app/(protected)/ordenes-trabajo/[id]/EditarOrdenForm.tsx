"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../../_components/Drawer";

const PRIORIDADES = ["BAJA", "NORMAL", "ALTA", "URGENTE"];

export interface OrdenEditable {
  id: string;
  establecimientoId: string | null;
  prioridad: string;
  fechaProgramada: Date | null;
  observaciones: string | null;
}

function fechaInput(fecha: Date | null): string {
  if (!fecha) return "";
  return new Date(fecha).toISOString().slice(0, 10);
}

export function EditarOrdenForm({ orden, establecimientos }: { orden: OrdenEditable; establecimientos: { id: string; nombre: string }[] }) {
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
      if (typeof value !== "string" || value.trim() === "") continue;
      body[key] = value.trim();
    }

    try {
      const response = await fetch(`/api/ordenes-trabajo/${orden.id}`, {
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
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        Editar
      </button>

      <Drawer title="Editar orden de trabajo" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="establecimientoId">Establecimiento</label>
              <select id="establecimientoId" name="establecimientoId" defaultValue={orden.establecimientoId ?? ""}>
                <option value="">Sin establecimiento</option>
                {establecimientos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="prioridad">Prioridad</label>
              <select id="prioridad" name="prioridad" defaultValue={orden.prioridad} required>
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="fechaProgramada">Fecha programada</label>
              <input id="fechaProgramada" name="fechaProgramada" type="date" className="mono" defaultValue={fechaInput(orden.fechaProgramada)} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="observaciones">Observaciones</label>
            <textarea id="observaciones" name="observaciones" rows={3} defaultValue={orden.observaciones ?? ""} />
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

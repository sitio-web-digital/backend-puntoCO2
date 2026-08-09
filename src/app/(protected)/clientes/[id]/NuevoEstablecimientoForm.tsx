"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Drawer } from "../../_components/Drawer";

/**
 * Encabezado del card "Establecimientos": título + contador + botón que
 * abre el drawer de alta.
 */
export function EstablecimientosHeader({ clienteId, count, children }: { clienteId: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="row-between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
        <div className="row" style={{ gap: 10, alignItems: "baseline" }}>
          <h2>Establecimientos</h2>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
            {count}
          </span>
        </div>
        <button type="button" className="btn-secondary btn-sm" title="Nuevo establecimiento" onClick={() => setOpen(true)}>
          + Establecimiento
        </button>
      </div>

      <NuevoEstablecimientoForm clienteId={clienteId} open={open} onClose={() => setOpen(false)} />

      {children}
    </>
  );
}

function NuevoEstablecimientoForm({ clienteId, open, onClose }: { clienteId: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setLoading(true);

    const formData = new FormData(form);
    const body: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value.trim() !== "") body[key] = value;
    }

    try {
      const response = await fetch(`/api/clientes/${clienteId}/establecimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo crear el establecimiento.");
        return;
      }
      onClose();
      form.reset();
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer title="Nuevo establecimiento" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="nombre">Nombre / identificación de la sede</label>
          <input id="nombre" name="nombre" required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="direccion">Dirección</label>
          <input id="direccion" name="direccion" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="provincia">Provincia</label>
          <input id="provincia" name="provincia" />
        </div>

        {error ? <p className="error">{error}</p> : null}

        <div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Guardando..." : "Guardar establecimiento"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

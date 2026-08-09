"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../_components/Drawer";

export function NuevoRetiroForm({ matafuegos }: { matafuegos: { id: string; codigoInterno: string }[] }) {
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
      if (typeof value === "string" && value.trim() !== "") body[key] = value;
    }

    try {
      const response = await fetch("/api/retiros-entregas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo registrar el retiro.");
        return;
      }
      setOpen(false);
      form.reset();
      router.push(`/retiros-entregas/${data.registro.id}`);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + Registrar retiro
      </button>

      <Drawer title="Registrar retiro" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="matafuegoId">Unidad</label>
            <select id="matafuegoId" name="matafuegoId" required defaultValue="">
              <option value="" disabled>
                Seleccionar...
              </option>
              {matafuegos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codigoInterno}
                </option>
              ))}
            </select>
          </div>

          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="personaQueEntrega">Persona que entrega</label>
              <input id="personaQueEntrega" name="personaQueEntrega" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="personaQueRetira">Persona que retira</label>
              <input id="personaQueRetira" name="personaQueRetira" />
            </div>
          </div>

          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="vehiculo">Vehículo</label>
              <input id="vehiculo" name="vehiculo" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="destino">Destino (si se conoce, pasa directo a &quot;en traslado&quot;)</label>
              <input id="destino" name="destino" />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="estadoUnidadRetiro">Estado de la unidad al retirar</label>
            <input id="estadoUnidadRetiro" name="estadoUnidadRetiro" placeholder="Ej: sin daños visibles" />
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Guardando..." : "Registrar retiro"}
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

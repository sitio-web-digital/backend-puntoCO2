"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Drawer } from "../_components/Drawer";

const TIPOS_SERVICIO = ["INSPECCION", "MANTENIMIENTO", "RECARGA", "PRUEBA_HIDRAULICA", "CAMBIO_AGENTE", "REPARACION", "RETIRO_ENTREGA", "OTRO"];

/**
 * Encabezado del card "Calendario": título + contador + botón que abre el
 * drawer del formulario (mismo patrón que EstablecimientosHeader en
 * clientes/[id]/NuevoEstablecimientoForm.tsx).
 */
export function CalendarioHeader({
  matafuegos,
  count,
  children,
}: {
  matafuegos: { id: string; codigoInterno: string }[];
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="row-between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
        <div className="row" style={{ gap: 10, alignItems: "baseline" }}>
          <h2>Calendario</h2>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
            {count}
          </span>
        </div>
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
          + Programar mantenimiento
        </button>
      </div>

      <NuevoMantenimientoForm matafuegos={matafuegos} open={open} onClose={() => setOpen(false)} />

      {children}
    </>
  );
}

function NuevoMantenimientoForm({
  matafuegos,
  open,
  onClose,
}: {
  matafuegos: { id: string; codigoInterno: string }[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
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
      const response = await fetch("/api/mantenimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo programar el mantenimiento.");
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
    <Drawer title="Nuevo mantenimiento programado" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
        <div className="grid2">
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
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="tipoServicio">Tipo de servicio</label>
            <select id="tipoServicio" name="tipoServicio" required defaultValue="">
              <option value="" disabled>
                Seleccionar...
              </option>
              {TIPOS_SERVICIO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="fechaProgramada">Fecha programada</label>
            <input id="fechaProgramada" name="fechaProgramada" type="date" className="mono" required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="prioridad">Prioridad</label>
            <select id="prioridad" name="prioridad" defaultValue="MEDIA">
              <option value="BAJA">Baja</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
              <option value="URGENTE">Urgente</option>
            </select>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="motivo">Motivo (obligatorio sólo para fechas pasadas)</label>
          <input id="motivo" name="motivo" />
          <p className="muted" style={{ marginTop: 6 }}>
            Si la fecha es pasada, se pide un motivo y queda registrado como ya realizado (carga retroactiva).
          </p>
        </div>

        {error ? <p className="error">{error}</p> : null}

        <div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

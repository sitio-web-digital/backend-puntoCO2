"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../../_components/Drawer";
import { SectorCard } from "./SectorCard";

interface Sector {
  id: string;
  nombre: string;
  responsable: string | null;
  observaciones: string | null;
  estado: string;
}

interface Ubicacion {
  id: string;
  sectorId: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
}

export function SectoresPanel({ establecimientoId, sectores }: { establecimientoId: string; sectores: (Sector & { ubicaciones: Ubicacion[] })[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="row" style={{ gap: 10, alignItems: "baseline" }}>
          <h2>Sectores</h2>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
            {sectores.length}
          </span>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
          + Sector
        </button>
      </div>

      {sectores.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Este establecimiento todavía no tiene sectores cargados.
          </p>
        </div>
      ) : (
        sectores.map((sector) => <SectorCard key={sector.id} sector={sector} ubicaciones={sector.ubicaciones} />)
      )}

      <NuevoSectorDrawer
        establecimientoId={establecimientoId}
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}

function NuevoSectorDrawer({
  establecimientoId,
  open,
  onClose,
  onCreated,
}: {
  establecimientoId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
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
      if (typeof value === "string" && value.trim() !== "") body[key] = value.trim();
    }
    try {
      const response = await fetch(`/api/establecimientos/${establecimientoId}/sectores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo crear el sector.");
        return;
      }
      onClose();
      form.reset();
      onCreated();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer title="Nuevo sector" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" placeholder="Ej: Sector A" required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="responsable">Responsable</label>
          <input id="responsable" name="responsable" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="observaciones">Observaciones</label>
          <textarea id="observaciones" name="observaciones" rows={3} />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Guardando..." : "Guardar sector"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

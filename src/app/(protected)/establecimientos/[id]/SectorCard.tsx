"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../../_components/Drawer";

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

export function SectorCard({ sector, ubicaciones }: { sector: Sector; ubicaciones: Ubicacion[] }) {
  const [editOpen, setEditOpen] = useState(false);
  const [nuevaUbicacionOpen, setNuevaUbicacionOpen] = useState(false);

  return (
    <div className="card stack" style={{ gap: 14 }}>
      <div className="row-between" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="stack" style={{ gap: 2 }}>
          <span style={{ fontSize: 14.5, fontWeight: 600 }}>{sector.nombre}</span>
          {sector.responsable ? <span className="muted">Responsable: {sector.responsable}</span> : null}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className={`badge badge-${sector.estado.toLowerCase()}`}>{sector.estado}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setEditOpen(true)}>
            Editar
          </button>
        </div>
      </div>

      <div className="row-between" style={{ gap: 10 }}>
        <span className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-3)" }}>
          Ubicaciones ({ubicaciones.length})
        </span>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setNuevaUbicacionOpen(true)}>
          + Ubicación
        </button>
      </div>

      {ubicaciones.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Este sector todavía no tiene ubicaciones cargadas.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ubicaciones.map((ubicacion) => (
                <UbicacionRow key={ubicacion.id} ubicacion={ubicacion} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EditarSectorDrawer sector={sector} open={editOpen} onClose={() => setEditOpen(false)} />
      <NuevaUbicacionDrawer sectorId={sector.id} open={nuevaUbicacionOpen} onClose={() => setNuevaUbicacionOpen(false)} />
    </div>
  );
}

function UbicacionRow({ ubicacion }: { ubicacion: Ubicacion }) {
  const [editOpen, setEditOpen] = useState(false);
  return (
    <tr>
      <td style={{ fontWeight: 500 }}>{ubicacion.nombre}</td>
      <td>{ubicacion.descripcion ?? "—"}</td>
      <td>
        <span className={`badge badge-${ubicacion.estado.toLowerCase()}`}>{ubicacion.estado}</span>
      </td>
      <td style={{ textAlign: "right" }}>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setEditOpen(true)}>
          Editar
        </button>
        <EditarUbicacionDrawer ubicacion={ubicacion} open={editOpen} onClose={() => setEditOpen(false)} />
      </td>
    </tr>
  );
}

function EditarSectorDrawer({ sector, open, onClose }: { sector: Sector; open: boolean; onClose: () => void }) {
  const router = useRouter();
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
      const response = await fetch(`/api/sectores/${sector.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo guardar los cambios.");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer title="Editar sector" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor={`sector-nombre-${sector.id}`}>Nombre</label>
          <input id={`sector-nombre-${sector.id}`} name="nombre" defaultValue={sector.nombre} required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor={`sector-responsable-${sector.id}`}>Responsable</label>
          <input id={`sector-responsable-${sector.id}`} name="responsable" defaultValue={sector.responsable ?? ""} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor={`sector-observaciones-${sector.id}`}>Observaciones</label>
          <textarea id={`sector-observaciones-${sector.id}`} name="observaciones" rows={3} defaultValue={sector.observaciones ?? ""} />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function NuevaUbicacionDrawer({ sectorId, open, onClose }: { sectorId: string; open: boolean; onClose: () => void }) {
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
      if (typeof value === "string" && value.trim() !== "") body[key] = value.trim();
    }
    try {
      const response = await fetch(`/api/sectores/${sectorId}/ubicaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo crear la ubicación.");
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
    <Drawer title="Nueva ubicación" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor={`nueva-ubicacion-nombre-${sectorId}`}>Nombre</label>
          <input id={`nueva-ubicacion-nombre-${sectorId}`} name="nombre" placeholder="Ej: Pasillo 1" required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor={`nueva-ubicacion-descripcion-${sectorId}`}>Descripción</label>
          <textarea id={`nueva-ubicacion-descripcion-${sectorId}`} name="descripcion" rows={2} />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Guardando..." : "Guardar ubicación"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function EditarUbicacionDrawer({ ubicacion, open, onClose }: { ubicacion: Ubicacion; open: boolean; onClose: () => void }) {
  const router = useRouter();
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
      const response = await fetch(`/api/ubicaciones/${ubicacion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo guardar los cambios.");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer title="Editar ubicación" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor={`ubicacion-nombre-${ubicacion.id}`}>Nombre</label>
          <input id={`ubicacion-nombre-${ubicacion.id}`} name="nombre" defaultValue={ubicacion.nombre} required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor={`ubicacion-descripcion-${ubicacion.id}`}>Descripción</label>
          <textarea id={`ubicacion-descripcion-${ubicacion.id}`} name="descripcion" rows={2} defaultValue={ubicacion.descripcion ?? ""} />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

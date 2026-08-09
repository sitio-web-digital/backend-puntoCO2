"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../../_components/Drawer";

export interface EstablecimientoEditable {
  id: string;
  nombre: string;
  direccion: string | null;
  provincia: string | null;
  localidad: string | null;
  codigoPostal: string | null;
  latitud: number | null;
  longitud: number | null;
  responsableSeguridad: string | null;
  contactoOperativo: string | null;
  email: string | null;
  telefono: string | null;
  horariosAtencion: string | null;
  indicacionesAcceso: string | null;
  normativaAplicable: string | null;
  observaciones: string | null;
}

export function EditarEstablecimientoForm({ establecimiento }: { establecimiento: EstablecimientoEditable }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string" || value.trim() === "") continue;
      body[key] = key === "latitud" || key === "longitud" ? Number(value) : value.trim();
    }

    try {
      const response = await fetch(`/api/establecimientos/${establecimiento.id}`, {
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

      <Drawer title="Editar establecimiento" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="nombre">Nombre / identificación de la sede</label>
              <input id="nombre" name="nombre" defaultValue={establecimiento.nombre} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="direccion">Dirección</label>
              <input id="direccion" name="direccion" defaultValue={establecimiento.direccion ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="provincia">Provincia</label>
              <input id="provincia" name="provincia" defaultValue={establecimiento.provincia ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="localidad">Localidad</label>
              <input id="localidad" name="localidad" defaultValue={establecimiento.localidad ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="codigoPostal">Código postal</label>
              <input id="codigoPostal" name="codigoPostal" defaultValue={establecimiento.codigoPostal ?? ""} />
            </div>
            <div />
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="latitud">Latitud</label>
              <input id="latitud" name="latitud" type="number" step="0.000001" className="mono" defaultValue={establecimiento.latitud ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="longitud">Longitud</label>
              <input id="longitud" name="longitud" type="number" step="0.000001" className="mono" defaultValue={establecimiento.longitud ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="responsableSeguridad">Responsable de seguridad</label>
              <input id="responsableSeguridad" name="responsableSeguridad" defaultValue={establecimiento.responsableSeguridad ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="contactoOperativo">Contacto operativo</label>
              <input id="contactoOperativo" name="contactoOperativo" defaultValue={establecimiento.contactoOperativo ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" defaultValue={establecimiento.email ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="telefono">Teléfono</label>
              <input id="telefono" name="telefono" defaultValue={establecimiento.telefono ?? ""} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="horariosAtencion">Horarios de atención</label>
            <input id="horariosAtencion" name="horariosAtencion" defaultValue={establecimiento.horariosAtencion ?? ""} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="indicacionesAcceso">Indicaciones de acceso</label>
            <textarea id="indicacionesAcceso" name="indicacionesAcceso" rows={2} defaultValue={establecimiento.indicacionesAcceso ?? ""} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="normativaAplicable">Normativa aplicable</label>
            <input id="normativaAplicable" name="normativaAplicable" defaultValue={establecimiento.normativaAplicable ?? ""} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="observaciones">Observaciones</label>
            <textarea id="observaciones" name="observaciones" rows={3} defaultValue={establecimiento.observaciones ?? ""} />
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

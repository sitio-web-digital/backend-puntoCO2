"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../_components/Drawer";
import { CamposTecnicosMatafuego } from "./CamposTecnicosMatafuego";

interface ClienteOption {
  id: string;
  nombre: string;
}

interface EstablecimientoOption {
  id: string;
  nombre: string;
}

export function NuevoMatafuegoForm({ clientes }: { clientes: ClienteOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [establecimientoId, setEstablecimientoId] = useState("");
  const [establecimientos, setEstablecimientos] = useState<EstablecimientoOption[]>([]);
  const [cargandoEstablecimientos, setCargandoEstablecimientos] = useState(false);
  const [nuevoEstablecimiento, setNuevoEstablecimiento] = useState(false);
  const [nombreEstablecimiento, setNombreEstablecimiento] = useState("");
  const [creandoEstablecimiento, setCreandoEstablecimiento] = useState(false);
  const [errorEstablecimiento, setErrorEstablecimiento] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClienteChange(nuevoClienteId: string) {
    setClienteId(nuevoClienteId);
    setEstablecimientoId("");
    setEstablecimientos([]);
    setNuevoEstablecimiento(false);
    if (!nuevoClienteId) return;

    setCargandoEstablecimientos(true);
    try {
      const response = await fetch(`/api/clientes/${nuevoClienteId}/establecimientos`);
      const data = await response.json();
      const lista: EstablecimientoOption[] = data.establecimientos ?? [];
      setEstablecimientos(lista);
      setNuevoEstablecimiento(lista.length === 0);
    } finally {
      setCargandoEstablecimientos(false);
    }
  }

  async function handleCrearEstablecimiento() {
    setErrorEstablecimiento(null);
    if (!nombreEstablecimiento.trim()) {
      setErrorEstablecimiento("Ingresá un nombre.");
      return;
    }
    setCreandoEstablecimiento(true);
    try {
      const response = await fetch(`/api/clientes/${clienteId}/establecimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreEstablecimiento.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorEstablecimiento(data.message ?? "No se pudo crear el establecimiento.");
        return;
      }
      setEstablecimientos((prev) => [...prev, data.establecimiento]);
      setEstablecimientoId(data.establecimiento.id);
      setNuevoEstablecimiento(false);
      setNombreEstablecimiento("");
    } catch {
      setErrorEstablecimiento("No se pudo conectar con el servidor.");
    } finally {
      setCreandoEstablecimiento(false);
    }
  }

  function reset() {
    setClienteId("");
    setEstablecimientoId("");
    setEstablecimientos([]);
    setNuevoEstablecimiento(false);
    setNombreEstablecimiento("");
    setErrorEstablecimiento(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    if (!clienteId || !establecimientoId) {
      setError("Elegí el cliente y el establecimiento propietario.");
      return;
    }
    setLoading(true);

    const formData = new FormData(form);
    const body: Record<string, unknown> = { clienteId, establecimientoId };
    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string" || value.trim() === "") continue;
      body[key] = key === "pesoNominal" ? Number(value) : value.trim();
    }

    try {
      const response = await fetch("/api/matafuegos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo crear el matafuego.");
        return;
      }
      setOpen(false);
      reset();
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
      <button
        type="button"
        className="btn-primary"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        + Nuevo matafuego
      </button>

      <Drawer title="Nuevo matafuego" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="clienteId">Cliente propietario</label>
              <select
                id="clienteId"
                value={clienteId}
                onChange={(e) => void handleClienteChange(e.target.value)}
                required
              >
                <option value="">Seleccionar...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="establecimientoId">Establecimiento</label>
              {nuevoEstablecimiento ? (
                <div className="row" style={{ gap: 8 }}>
                  <input
                    id="establecimientoId"
                    value={nombreEstablecimiento}
                    onChange={(e) => setNombreEstablecimiento(e.target.value)}
                    placeholder="Ej: Planta Central"
                    disabled={creandoEstablecimiento}
                  />
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => void handleCrearEstablecimiento()}
                    disabled={creandoEstablecimiento}
                  >
                    {creandoEstablecimiento ? "..." : "Crear"}
                  </button>
                  {establecimientos.length > 0 ? (
                    <button type="button" className="btn-secondary btn-sm" onClick={() => setNuevoEstablecimiento(false)} disabled={creandoEstablecimiento}>
                      Cancelar
                    </button>
                  ) : null}
                </div>
              ) : (
                <select
                  id="establecimientoId"
                  value={establecimientoId}
                  onChange={(e) => {
                    if (e.target.value === "__nuevo__") {
                      setNuevoEstablecimiento(true);
                      return;
                    }
                    setEstablecimientoId(e.target.value);
                  }}
                  disabled={!clienteId || cargandoEstablecimientos}
                  required
                >
                  <option value="">{cargandoEstablecimientos ? "Cargando..." : "Seleccionar..."}</option>
                  {establecimientos.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                  <option value="__nuevo__">+ Nuevo establecimiento...</option>
                </select>
              )}
              {errorEstablecimiento ? <p className="error">{errorEstablecimiento}</p> : null}
            </div>
          </div>

          <CamposTecnicosMatafuego />

          {error ? <p className="error">{error}</p> : null}

          <div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Guardando..." : "Guardar matafuego"}
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../_components/Drawer";

interface ClienteOption {
  id: string;
  nombre: string;
}

interface MatafuegoOption {
  id: string;
  codigoInterno: string;
  clienteId: string;
}

export function NuevaOrdenForm({ clientes, matafuegos }: { clientes: ClienteOption[]; matafuegos: MatafuegoOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [matafuegoIds, setMatafuegoIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const unidadesDelCliente = matafuegos.filter((m) => m.clienteId === clienteId);

  function toggleUnidad(id: string) {
    setMatafuegoIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    if (!clienteId) {
      setError("Elegí un cliente.");
      return;
    }
    setLoading(true);

    const formData = new FormData(form);
    const body: Record<string, unknown> = { clienteId, matafuegoIds };
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value.trim() !== "") body[key] = value;
    }

    try {
      const response = await fetch("/api/ordenes-trabajo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo crear la orden.");
        return;
      }
      setOpen(false);
      setClienteId("");
      setMatafuegoIds([]);
      form.reset();
      router.push(`/ordenes-trabajo/${data.orden.id}`);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + Nueva orden
      </button>

      <Drawer title="Nueva orden" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="clienteId">Cliente</label>
            <select
              id="clienteId"
              value={clienteId}
              onChange={(e) => {
                setClienteId(e.target.value);
                setMatafuegoIds([]);
              }}
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

          {clienteId ? (
            <div>
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                  fontFamily: "var(--font-mono)",
                  marginBottom: 10,
                }}
              >
                Unidades incluidas (opcional)
              </span>
              {unidadesDelCliente.length === 0 ? (
                <p className="muted">Este cliente no tiene matafuegos cargados todavía.</p>
              ) : (
                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  {unidadesDelCliente.map((m) => (
                    <label key={m.id} className="checkbox-pill">
                      <input type="checkbox" checked={matafuegoIds.includes(m.id)} onChange={() => toggleUnidad(m.id)} />
                      <span className="mono">{m.codigoInterno}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="prioridad">Prioridad</label>
              <select id="prioridad" name="prioridad" defaultValue="NORMAL">
                <option value="BAJA">Baja</option>
                <option value="NORMAL">Normal</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="fechaProgramada">Fecha programada (opcional)</label>
              <input id="fechaProgramada" name="fechaProgramada" type="date" className="mono" />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="observaciones">Observaciones</label>
            <textarea id="observaciones" name="observaciones" rows={2} />
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Guardando..." : "Crear orden"}
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

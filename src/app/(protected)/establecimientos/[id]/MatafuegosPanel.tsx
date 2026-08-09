"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../../_components/Drawer";
import { EstadoBadge } from "../../_lib/estado-badge";
import { EditarMatafuegoForm, type MatafuegoEditable } from "../../matafuegos/[id]/EditarMatafuegoForm";
import { CamposTecnicosMatafuego } from "../../matafuegos/CamposTecnicosMatafuego";

interface Sector {
  id: string;
  nombre: string;
}

interface Ubicacion {
  id: string;
  sectorId: string;
  nombre: string;
}

interface MatafuegoListado extends MatafuegoEditable {
  estado: string;
  qrToken: string;
}

export function MatafuegosPanel({
  clienteId,
  establecimientoId,
  sectores,
  matafuegos,
}: {
  clienteId: string;
  establecimientoId: string;
  sectores: (Sector & { ubicaciones: Ubicacion[] })[];
  matafuegos: MatafuegoListado[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="row" style={{ gap: 10, alignItems: "baseline" }}>
          <h2>Matafuegos</h2>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
            {matafuegos.length}
          </span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {matafuegos.length > 0 ? (
            <Link href={`/matafuegos/imprimir-qr?establecimientoId=${establecimientoId}`} className="btn-secondary btn-sm">
              Imprimir QRs
            </Link>
          ) : null}
          <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
            + Nuevo matafuego
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {matafuegos.length === 0 ? (
          <p className="muted" style={{ padding: 16, margin: 0 }}>
            Este establecimiento todavía no tiene matafuegos cargados.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Código interno</th>
                  <th>N° de serie</th>
                  <th>Tipo</th>
                  <th>Agente</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {matafuegos.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/matafuegos/${m.id}`} className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>
                        {m.codigoInterno}
                      </Link>
                    </td>
                    <td className="mono">{m.numeroSerie}</td>
                    <td>{m.tipo}</td>
                    <td>{m.agenteExtintor}</td>
                    <td>
                      <EstadoBadge estado={m.estado} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <EditarMatafuegoForm matafuego={m} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NuevoMatafuegoDrawer
        clienteId={clienteId}
        establecimientoId={establecimientoId}
        sectores={sectores}
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}

function NuevoMatafuegoDrawer({
  clienteId,
  establecimientoId,
  sectores,
  open,
  onClose,
  onCreated,
}: {
  clienteId: string;
  establecimientoId: string;
  sectores: (Sector & { ubicaciones: Ubicacion[] })[];
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sectorId, setSectorId] = useState("");

  const ubicaciones = sectores.find((s) => s.id === sectorId)?.ubicaciones ?? [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
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
      onClose();
      form.reset();
      setSectorId("");
      onCreated();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer title="Nuevo matafuego" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
        <div className="grid2">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="sectorId">Sector</label>
            <select id="sectorId" name="sectorId" value={sectorId} onChange={(e) => setSectorId(e.target.value)}>
              <option value="">— Sin asignar —</option>
              {sectores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="ubicacionId">Ubicación</label>
            <select id="ubicacionId" name="ubicacionId" defaultValue="" disabled={!sectorId}>
              <option value="">— Sin asignar —</option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
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
  );
}

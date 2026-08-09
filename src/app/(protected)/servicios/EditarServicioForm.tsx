"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../_components/Drawer";

const CATEGORIAS = [
  "RECARGA",
  "PRUEBA_HIDRAULICA",
  "PINTURA",
  "REPARACION",
  "CAMBIO_AGENTE",
  "INSPECCION",
  "MANTENIMIENTO",
  "REEMPLAZO_REPUESTOS",
  "VENTA",
  "INSTALACION",
  "RETIRO_ENTREGA",
  "OTRO",
];
const AGENTES = ["POLVO_QUIMICO_ABC", "CO2", "AGUA", "ESPUMA", "AGENTE_LIMPIO", "OTRO"];
const MONEDAS = ["ARS", "USD"];

export interface ServicioEditable {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  descripcion: string | null;
  precioBase: number;
  costoEstimado: number | null;
  iva: number;
  moneda: string;
  duracionEstimadaMinutos: number | null;
  agentesCompatibles: string[];
  capacidadesCompatibles: string[];
  requiereRetiro: boolean;
  requiereEnsayo: boolean;
  requiereRepuestos: boolean;
  requiereCertificado: boolean;
  vigenteDesde: Date | null;
  vigenteHasta: Date | null;
}

function fechaInput(fecha: Date | null): string {
  if (!fecha) return "";
  return new Date(fecha).toISOString().slice(0, 10);
}

export function EditarServicioForm({ servicio }: { servicio: ServicioEditable }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      categoria: formData.get("categoria") as string,
      moneda: formData.get("moneda") as string,
      agentesCompatibles: formData.getAll("agentesCompatibles") as string[],
      capacidadesCompatibles: ((formData.get("capacidadesCompatibles") as string) ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      requiereRetiro: formData.get("requiereRetiro") === "on",
      requiereEnsayo: formData.get("requiereEnsayo") === "on",
      requiereRepuestos: formData.get("requiereRepuestos") === "on",
      requiereCertificado: formData.get("requiereCertificado") === "on",
    };

    const codigo = (formData.get("codigo") as string).trim();
    if (codigo) body.codigo = codigo;
    const nombre = (formData.get("nombre") as string).trim();
    if (nombre) body.nombre = nombre;
    const descripcion = (formData.get("descripcion") as string).trim();
    if (descripcion) body.descripcion = descripcion;
    const precioBase = formData.get("precioBase") as string;
    if (precioBase) body.precioBase = Number(precioBase);
    const costoEstimado = formData.get("costoEstimado") as string;
    if (costoEstimado) body.costoEstimado = Number(costoEstimado);
    const iva = formData.get("iva") as string;
    if (iva) body.iva = Number(iva);
    const duracionEstimadaMinutos = formData.get("duracionEstimadaMinutos") as string;
    if (duracionEstimadaMinutos) body.duracionEstimadaMinutos = Number(duracionEstimadaMinutos);
    const vigenteDesde = formData.get("vigenteDesde") as string;
    if (vigenteDesde) body.vigenteDesde = vigenteDesde;
    const vigenteHasta = formData.get("vigenteHasta") as string;
    if (vigenteHasta) body.vigenteHasta = vigenteHasta;

    try {
      const response = await fetch(`/api/servicios/${servicio.id}`, {
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
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
        Editar
      </button>

      <Drawer title="Editar servicio" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="codigo">Código</label>
              <input id="codigo" name="codigo" className="mono" defaultValue={servicio.codigo} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" defaultValue={servicio.nombre} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="categoria">Categoría</label>
              <select id="categoria" name="categoria" defaultValue={servicio.categoria} required>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="moneda">Moneda</label>
              <select id="moneda" name="moneda" defaultValue={servicio.moneda} required>
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="precioBase">Precio base ($)</label>
              <input id="precioBase" name="precioBase" type="number" className="mono" min={0} step="0.01" defaultValue={servicio.precioBase} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="costoEstimado">Costo estimado ($, opcional)</label>
              <input
                id="costoEstimado"
                name="costoEstimado"
                type="number"
                className="mono"
                min={0}
                step="0.01"
                defaultValue={servicio.costoEstimado ?? ""}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="iva">IVA (%)</label>
              <input id="iva" name="iva" type="number" className="mono" min={0} max={100} step="0.01" defaultValue={servicio.iva} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="duracionEstimadaMinutos">Duración estimada (min)</label>
              <input
                id="duracionEstimadaMinutos"
                name="duracionEstimadaMinutos"
                type="number"
                className="mono"
                min={1}
                step="1"
                defaultValue={servicio.duracionEstimadaMinutos ?? ""}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="vigenteDesde">Vigente desde</label>
              <input id="vigenteDesde" name="vigenteDesde" type="date" className="mono" defaultValue={fechaInput(servicio.vigenteDesde)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="vigenteHasta">Vigente hasta</label>
              <input id="vigenteHasta" name="vigenteHasta" type="date" className="mono" defaultValue={fechaInput(servicio.vigenteHasta)} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="descripcion">Descripción</label>
            <textarea id="descripcion" name="descripcion" rows={3} defaultValue={servicio.descripcion ?? ""} />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="capacidadesCompatibles">Capacidades compatibles (separadas por coma)</label>
            <input
              id="capacidadesCompatibles"
              name="capacidadesCompatibles"
              placeholder="1kg, 5kg, 10kg"
              defaultValue={servicio.capacidadesCompatibles.join(", ")}
            />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Agentes extintores compatibles</label>
            <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
              {AGENTES.map((a) => (
                <label key={a} className="checkbox-pill" style={{ width: "fit-content" }}>
                  <input type="checkbox" name="agentesCompatibles" value={a} defaultChecked={servicio.agentesCompatibles.includes(a)} />
                  {a}
                </label>
              ))}
            </div>
          </div>

          <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
            <label className="checkbox-pill" style={{ width: "fit-content" }}>
              <input type="checkbox" name="requiereRetiro" defaultChecked={servicio.requiereRetiro} />
              Requiere retiro
            </label>
            <label className="checkbox-pill" style={{ width: "fit-content" }}>
              <input type="checkbox" name="requiereEnsayo" defaultChecked={servicio.requiereEnsayo} />
              Requiere ensayo
            </label>
            <label className="checkbox-pill" style={{ width: "fit-content" }}>
              <input type="checkbox" name="requiereRepuestos" defaultChecked={servicio.requiereRepuestos} />
              Requiere repuestos
            </label>
            <label className="checkbox-pill" style={{ width: "fit-content" }}>
              <input type="checkbox" name="requiereCertificado" defaultChecked={servicio.requiereCertificado} />
              Requiere certificado
            </label>
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

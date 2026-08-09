"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../_components/Drawer";

const TIPOS = [
  { value: "CERTIFICADO_MANTENIMIENTO", label: "Certificado de mantenimiento" },
  { value: "CERTIFICADO_RECARGA", label: "Certificado de recarga" },
  { value: "INFORME_INSPECCION", label: "Informe de inspección" },
  { value: "ACTA_RETIRO", label: "Acta de retiro" },
  { value: "ACTA_ENTREGA", label: "Acta de entrega" },
  { value: "INFORME_PRUEBA_HIDRAULICA", label: "Informe de prueba hidráulica" },
  { value: "CONSTANCIA_NO_CONFORMIDAD", label: "Constancia de no conformidad" },
  { value: "PLANILLA_DOTACION", label: "Planilla de dotación" },
  { value: "HISTORIAL_TECNICO", label: "Historial técnico" },
  { value: "CERTIFICADO_BAJA", label: "Certificado de baja" },
];

export function EmitirCertificadoForm({ ordenes }: { ordenes: { id: string; numero: number }[] }) {
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
      if (typeof value === "string" && value.trim() !== "") body[key] = value;
    }

    try {
      const response = await fetch("/api/certificados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo emitir el certificado.");
        return;
      }
      setOpen(false);
      router.push(`/certificados/${data.certificado.id}`);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + Emitir certificado
      </button>

      <Drawer title="Emitir certificado" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="ordenTrabajoId">Orden de trabajo</label>
              <select id="ordenTrabajoId" name="ordenTrabajoId" required defaultValue="" disabled={ordenes.length === 0}>
                <option value="" disabled>
                  Seleccionar...
                </option>
                {ordenes.map((o) => (
                  <option key={o.id} value={o.id}>
                    Orden #{o.numero}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="tipo">Tipo de documento</label>
              <select id="tipo" name="tipo" required defaultValue="">
                <option value="" disabled>
                  Seleccionar...
                </option>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="responsableTecnicoNombre">Responsable técnico</label>
              <input id="responsableTecnicoNombre" name="responsableTecnicoNombre" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="vigenciaHasta">Vigencia hasta (opcional)</label>
              <input id="vigenciaHasta" name="vigenciaHasta" type="date" className="mono" />
            </div>
          </div>

          {ordenes.length === 0 ? <p className="muted">No hay órdenes finalizadas/entregadas/facturadas disponibles para emitir.</p> : null}
          {error ? <p className="error">{error}</p> : null}

          <div>
            <button type="submit" className="btn-primary" disabled={loading || ordenes.length === 0}>
              {loading ? "Emitiendo..." : "Emitir"}
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

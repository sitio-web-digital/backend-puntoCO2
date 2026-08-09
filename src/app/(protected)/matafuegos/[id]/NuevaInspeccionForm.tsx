"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../../_components/Drawer";

const RESULTADOS = [
  { value: "APTO", label: "Apto" },
  { value: "APTO_CON_OBSERVACIONES", label: "Apto con observaciones" },
  { value: "REQUIERE_MANTENIMIENTO", label: "Requiere mantenimiento" },
  { value: "REQUIERE_RECARGA", label: "Requiere recarga" },
  { value: "REQUIERE_REEMPLAZO", label: "Requiere reemplazo" },
  { value: "NO_ENCONTRADO", label: "No encontrado" },
  { value: "ACCESO_IMPOSIBLE", label: "Acceso imposible" },
];

const CHECKLIST: { campo: string; etiqueta: string }[] = [
  { campo: "equipoPresente", etiqueta: "Equipo presente" },
  { campo: "accesoLibre", etiqueta: "Acceso libre" },
  { campo: "senalizacionVisible", etiqueta: "Señalización visible" },
  { campo: "soporteFirme", etiqueta: "Soporte firme" },
  { campo: "ausenciaDanios", etiqueta: "Sin daños" },
  { campo: "ausenciaCorrosion", etiqueta: "Sin corrosión" },
  { campo: "mangueraEnBuenEstado", etiqueta: "Manguera en buen estado" },
  { campo: "boquillaSinObstrucciones", etiqueta: "Boquilla sin obstrucciones" },
  { campo: "precintoIntacto", etiqueta: "Precinto intacto" },
  { campo: "pasadorSeguridadColocado", etiqueta: "Pasador de seguridad colocado" },
  { campo: "manometroDentroDeRango", etiqueta: "Manómetro dentro de rango" },
  { campo: "pesoDentroDeTolerancia", etiqueta: "Peso dentro de tolerancia" },
  { campo: "etiquetaLegible", etiqueta: "Etiqueta legible" },
  { campo: "fechaVigente", etiqueta: "Fecha vigente" },
  { campo: "sinIndiciosDeDescarga", etiqueta: "Sin indicios de descarga" },
  { campo: "ubicacionCorrecta", etiqueta: "Ubicación correcta" },
];

export function NuevaInspeccionForm({ matafuegoId }: { matafuegoId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleItem(campo: string) {
    setChecklist((prev) => ({ ...prev, [campo]: !prev[campo] }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setLoading(true);

    const formData = new FormData(form);
    const body: Record<string, unknown> = { ...checklist };
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value.trim() !== "") body[key] = value;
    }

    try {
      const response = await fetch(`/api/matafuegos/${matafuegoId}/inspecciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo registrar la inspección.");
        return;
      }
      setOpen(false);
      setChecklist({});
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
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        Registrar inspección
      </button>

      <Drawer title="Registrar inspección" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="resultado">Resultado</label>
            <select id="resultado" name="resultado" required defaultValue="">
              <option value="" disabled>
                Seleccionar...
              </option>
              {RESULTADOS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="comentarios">Comentarios</label>
            <textarea id="comentarios" name="comentarios" rows={3} />
          </div>

          <div>
            <label>Checklist técnico</label>
            <div className="detail-grid">
              {CHECKLIST.map((item) => (
                <label key={item.campo} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.88rem", color: "var(--text)", textTransform: "none", fontFamily: "inherit", fontWeight: 400, letterSpacing: "normal" }}>
                  <input type="checkbox" checked={checklist[item.campo] ?? false} onChange={() => toggleItem(item.campo)} style={{ width: "auto" }} />
                  {item.etiqueta}
                </label>
              ))}
            </div>
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Guardando..." : "Guardar inspección"}
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

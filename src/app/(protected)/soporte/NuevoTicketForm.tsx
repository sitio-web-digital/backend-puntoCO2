"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../_components/Drawer";

const PRIORIDADES = ["BAJA", "NORMAL", "ALTA", "URGENTE"];

export function NuevoTicketForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setLoading(true);

    const formData = new FormData(form);
    const body = {
      asunto: String(formData.get("asunto") ?? ""),
      mensaje: String(formData.get("mensaje") ?? ""),
      prioridad: String(formData.get("prioridad") ?? "NORMAL"),
    };

    try {
      const response = await fetch("/api/soporte/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo crear el ticket.");
        return;
      }
      setOpen(false);
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
        + Nuevo ticket
      </button>

      <Drawer title="Nuevo ticket de soporte" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="asunto">Asunto</label>
            <input id="asunto" name="asunto" placeholder="Ej: No puedo emitir un certificado" required maxLength={200} />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="prioridad">Prioridad</label>
            <select id="prioridad" name="prioridad" defaultValue="NORMAL">
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="mensaje">Mensaje</label>
            <textarea id="mensaje" name="mensaje" rows={5} placeholder="Contanos qué necesitás..." required maxLength={5000} />
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div>
            <button type="submit" className="btn-primary" title="Crear ticket" disabled={loading}>
              {loading ? "Creando..." : "Crear ticket"}
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const CONDICIONES_IVA = ["RESPONSABLE_INSCRIPTO", "MONOTRIBUTISTA", "EXENTO", "CONSUMIDOR_FINAL", "NO_RESPONSABLE"];
const TIPOS_CONSUMIDOR = ["CONSUMIDOR_FINAL", "EMPRESA", "ORGANISMO_PUBLICO"];

export function NuevoClienteForm() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipoCliente, setTipoCliente] = useState<"PERSONA_HUMANA" | "PERSONA_JURIDICA">("PERSONA_JURIDICA");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const body: Record<string, string> = { tipoCliente };
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value.trim() !== "") body[key] = value;
    }

    try {
      const response = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo crear el cliente.");
        return;
      }
      setAbierto(false);
      event.currentTarget.reset();
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (!abierto) {
    return (
      <button type="button" className="btn-primary" onClick={() => setAbierto(true)}>
        + Nuevo cliente
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="stack" style={{ gap: 0 }}>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h2>Nuevo cliente</h2>
        <button type="button" className="btn-link" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
      </div>

      <div className="field">
        <label htmlFor="tipoCliente">Tipo de cliente</label>
        <select id="tipoCliente" value={tipoCliente} onChange={(e) => setTipoCliente(e.target.value as typeof tipoCliente)}>
          <option value="PERSONA_JURIDICA">Persona jurídica</option>
          <option value="PERSONA_HUMANA">Persona humana</option>
        </select>
      </div>

      {tipoCliente === "PERSONA_JURIDICA" ? (
        <div className="field">
          <label htmlFor="razonSocial">Razón social</label>
          <input id="razonSocial" name="razonSocial" required />
        </div>
      ) : (
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" name="nombre" required />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="apellido">Apellido</label>
            <input id="apellido" name="apellido" required />
          </div>
        </div>
      )}

      <div className="row">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="condicionIva">Condición frente al IVA</label>
          <select id="condicionIva" name="condicionIva" required defaultValue="">
            <option value="" disabled>
              Seleccionar...
            </option>
            {CONDICIONES_IVA.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="tipoConsumidor">Tipo de consumidor</label>
          <select id="tipoConsumidor" name="tipoConsumidor" required defaultValue="">
            <option value="" disabled>
              Seleccionar...
            </option>
            {TIPOS_CONSUMIDOR.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="cuit">CUIT</label>
          <input id="cuit" name="cuit" placeholder="20-12345678-9" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" />
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? "Guardando..." : "Guardar cliente"}
      </button>
    </form>
  );
}

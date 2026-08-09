"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../_components/Drawer";

const CONDICIONES_IVA = ["RESPONSABLE_INSCRIPTO", "MONOTRIBUTISTA", "EXENTO", "CONSUMIDOR_FINAL", "NO_RESPONSABLE"];
const TIPOS_CONSUMIDOR = ["CONSUMIDOR_FINAL", "EMPRESA", "ORGANISMO_PUBLICO"];
const CANALES = ["EMAIL", "WHATSAPP", "TELEFONO"];

export function NuevoClienteForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tipoCliente, setTipoCliente] = useState<"PERSONA_HUMANA" | "PERSONA_JURIDICA">("PERSONA_JURIDICA");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setLoading(true);

    const formData = new FormData(form);
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
        + Nuevo cliente
      </button>

      <Drawer title="Nuevo cliente" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="tipoCliente">Tipo de cliente</label>
              <select id="tipoCliente" value={tipoCliente} onChange={(e) => setTipoCliente(e.target.value as typeof tipoCliente)}>
                <option value="PERSONA_JURIDICA">Persona jurídica</option>
                <option value="PERSONA_HUMANA">Persona humana</option>
              </select>
            </div>

            {tipoCliente === "PERSONA_JURIDICA" ? (
              <>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="razonSocial">Razón social</label>
                  <input id="razonSocial" name="razonSocial" placeholder="Ej: Supermercado La Espiga SRL" required />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="nombreFantasia">Nombre de fantasía</label>
                  <input id="nombreFantasia" name="nombreFantasia" />
                </div>
              </>
            ) : (
              <>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="nombre">Nombre</label>
                  <input id="nombre" name="nombre" required />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="apellido">Apellido</label>
                  <input id="apellido" name="apellido" required />
                </div>
              </>
            )}

            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="cuit">CUIT</label>
              <input id="cuit" name="cuit" className="mono" placeholder="20-12345678-9" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
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
            <div className="field" style={{ marginBottom: 0 }}>
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
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="canalPreferido">Canal preferido</label>
              <select id="canalPreferido" name="canalPreferido" defaultValue="EMAIL">
                {CANALES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="whatsapp">WhatsApp</label>
              <input id="whatsapp" name="whatsapp" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="telefonoAlternativo">Teléfono alternativo</label>
              <input id="telefonoAlternativo" name="telefonoAlternativo" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="condicionPago">Condición de pago</label>
              <input id="condicionPago" name="condicionPago" />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="domicilioFiscal">Domicilio fiscal</label>
              <input id="domicilioFiscal" name="domicilioFiscal" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="provincia">Provincia</label>
              <input id="provincia" name="provincia" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="localidad">Localidad</label>
              <input id="localidad" name="localidad" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="codigoPostal">Código postal</label>
              <input id="codigoPostal" name="codigoPostal" />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="observaciones">Observaciones</label>
            <textarea id="observaciones" name="observaciones" rows={3} />
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div>
            <button type="submit" className="btn-primary" title="Guardar cliente" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

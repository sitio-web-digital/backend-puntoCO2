"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Drawer } from "../../_components/Drawer";

const CONDICIONES_IVA = ["RESPONSABLE_INSCRIPTO", "MONOTRIBUTISTA", "EXENTO", "CONSUMIDOR_FINAL", "NO_RESPONSABLE"];
const TIPOS_CONSUMIDOR = ["CONSUMIDOR_FINAL", "EMPRESA", "ORGANISMO_PUBLICO"];
const CANALES = ["EMAIL", "WHATSAPP", "TELEFONO"];

export interface ClienteEditable {
  id: string;
  tipoCliente: string;
  nombre: string | null;
  apellido: string | null;
  razonSocial: string | null;
  nombreFantasia: string | null;
  cuit: string | null;
  condicionIva: string;
  tipoConsumidor: string;
  email: string | null;
  whatsapp: string | null;
  telefonoAlternativo: string | null;
  domicilioFiscal: string | null;
  provincia: string | null;
  localidad: string | null;
  codigoPostal: string | null;
  canalPreferido: string;
  condicionPago: string | null;
  observaciones: string | null;
}

export function EditarClienteForm({ cliente, size = "md" }: { cliente: ClienteEditable; size?: "md" | "sm" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tipoCliente, setTipoCliente] = useState<"PERSONA_HUMANA" | "PERSONA_JURIDICA">(cliente.tipoCliente as "PERSONA_HUMANA" | "PERSONA_JURIDICA");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const body: Record<string, string> = { tipoCliente };
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") body[key] = value.trim();
    }

    try {
      const response = await fetch(`/api/clientes/${cliente.id}`, {
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
      <button type="button" className={size === "sm" ? "btn-secondary btn-sm" : "btn-secondary"} onClick={() => setOpen(true)}>
        Editar
      </button>

      <Drawer title="Editar cliente" open={open} onClose={() => setOpen(false)}>
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
                  <input id="razonSocial" name="razonSocial" defaultValue={cliente.razonSocial ?? ""} required />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="nombreFantasia">Nombre de fantasía</label>
                  <input id="nombreFantasia" name="nombreFantasia" defaultValue={cliente.nombreFantasia ?? ""} />
                </div>
              </>
            ) : (
              <>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="nombre">Nombre</label>
                  <input id="nombre" name="nombre" defaultValue={cliente.nombre ?? ""} required />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="apellido">Apellido</label>
                  <input id="apellido" name="apellido" defaultValue={cliente.apellido ?? ""} required />
                </div>
              </>
            )}

            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="cuit">CUIT</label>
              <input id="cuit" name="cuit" className="mono" defaultValue={cliente.cuit ?? ""} placeholder="20-12345678-9" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="condicionIva">Condición frente al IVA</label>
              <select id="condicionIva" name="condicionIva" defaultValue={cliente.condicionIva} required>
                {CONDICIONES_IVA.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="tipoConsumidor">Tipo de consumidor</label>
              <select id="tipoConsumidor" name="tipoConsumidor" defaultValue={cliente.tipoConsumidor} required>
                {TIPOS_CONSUMIDOR.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="canalPreferido">Canal preferido</label>
              <select id="canalPreferido" name="canalPreferido" defaultValue={cliente.canalPreferido}>
                {CANALES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" defaultValue={cliente.email ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="whatsapp">WhatsApp</label>
              <input id="whatsapp" name="whatsapp" defaultValue={cliente.whatsapp ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="telefonoAlternativo">Teléfono alternativo</label>
              <input id="telefonoAlternativo" name="telefonoAlternativo" defaultValue={cliente.telefonoAlternativo ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="condicionPago">Condición de pago</label>
              <input id="condicionPago" name="condicionPago" defaultValue={cliente.condicionPago ?? ""} />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="domicilioFiscal">Domicilio fiscal</label>
              <input id="domicilioFiscal" name="domicilioFiscal" defaultValue={cliente.domicilioFiscal ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="provincia">Provincia</label>
              <input id="provincia" name="provincia" defaultValue={cliente.provincia ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="localidad">Localidad</label>
              <input id="localidad" name="localidad" defaultValue={cliente.localidad ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="codigoPostal">Código postal</label>
              <input id="codigoPostal" name="codigoPostal" defaultValue={cliente.codigoPostal ?? ""} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="observaciones">Observaciones</label>
            <textarea id="observaciones" name="observaciones" rows={3} defaultValue={cliente.observaciones ?? ""} />
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

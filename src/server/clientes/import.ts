import { z } from "zod";
import { generarPlantillaExcel, leerFilasExcel, type FilaImportResultado, type ImportColumn, type ResumenImport } from "../import/excel";
import { createCliente, type TenantActor } from "./service";
import type { CreateClienteInput } from "./schemas";

const TIPO_CLIENTE = { "persona juridica": "PERSONA_JURIDICA", "persona humana": "PERSONA_HUMANA" } as const;
const CONDICION_IVA = {
  "responsable inscripto": "RESPONSABLE_INSCRIPTO",
  monotributista: "MONOTRIBUTISTA",
  exento: "EXENTO",
  "consumidor final": "CONSUMIDOR_FINAL",
  "no responsable": "NO_RESPONSABLE",
} as const;
const TIPO_CONSUMIDOR = { "consumidor final": "CONSUMIDOR_FINAL", empresa: "EMPRESA", "organismo publico": "ORGANISMO_PUBLICO" } as const;
const CANAL_PREFERIDO = { email: "EMAIL", whatsapp: "WHATSAPP", telefono: "TELEFONO" } as const;

const CLIENTE_IMPORT_COLUMNS: ImportColumn[] = [
  {
    header: "Tipo de cliente",
    key: "tipoCliente",
    width: 20,
    ejemplo: "Persona jurídica",
    valoresPermitidos: ["Persona jurídica", "Persona humana"],
  },
  { header: "Nombre (persona humana)", key: "nombre", width: 20, ejemplo: "" },
  { header: "Apellido (persona humana)", key: "apellido", width: 20, ejemplo: "" },
  { header: "Razón social (persona jurídica)", key: "razonSocial", width: 30, ejemplo: "Supermercado La Espiga SRL" },
  { header: "Nombre de fantasía (opcional)", key: "nombreFantasia", width: 24 },
  { header: "CUIT (opcional)", key: "cuit", width: 18, ejemplo: "30-71234567-8" },
  {
    header: "Condición IVA",
    key: "condicionIva",
    width: 22,
    ejemplo: "Responsable inscripto",
    valoresPermitidos: ["Responsable inscripto", "Monotributista", "Exento", "Consumidor final", "No responsable"],
  },
  {
    header: "Tipo de consumidor",
    key: "tipoConsumidor",
    width: 20,
    ejemplo: "Empresa",
    valoresPermitidos: ["Consumidor final", "Empresa", "Organismo público"],
  },
  { header: "Email (opcional)", key: "email", width: 26, ejemplo: "compras@empresa.com.ar" },
  { header: "WhatsApp (opcional)", key: "whatsapp", width: 18, ejemplo: "+54 9 11 5555-1234" },
  { header: "Teléfono alternativo (opcional)", key: "telefonoAlternativo", width: 20 },
  { header: "Domicilio fiscal (opcional)", key: "domicilioFiscal", width: 30 },
  { header: "Provincia (opcional)", key: "provincia", width: 18, ejemplo: "Buenos Aires" },
  { header: "Localidad (opcional)", key: "localidad", width: 18 },
  { header: "Código postal (opcional)", key: "codigoPostal", width: 14 },
  {
    header: "Canal preferido (opcional)",
    key: "canalPreferido",
    width: 18,
    ejemplo: "Email",
    valoresPermitidos: ["Email", "WhatsApp", "Teléfono"],
  },
  { header: "Condición de pago (opcional)", key: "condicionPago", width: 20 },
  { header: "Observaciones (opcional)", key: "observaciones", width: 30 },
];

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

function resolverEnum<T extends Record<string, string>>(valor: string, mapa: T): string {
  if (!valor) return "";
  const normalizado = valor
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .trim()
    .toLowerCase();
  if (normalizado in mapa) return mapa[normalizado as keyof T] ?? "";
  // Si ya viene como clave de enum válida (ej. "PERSONA_JURIDICA"), se deja pasar tal cual
  // para que el propio schema la valide; así también funciona reimportar un export propio.
  return valor.trim().toUpperCase().replace(/\s+/g, "_");
}

function parseClienteRow(valores: Record<string, string>): Record<string, unknown> {
  return {
    tipoCliente: resolverEnum(valores.tipoCliente ?? "", TIPO_CLIENTE),
    nombre: valores.nombre || undefined,
    apellido: valores.apellido || undefined,
    razonSocial: valores.razonSocial || undefined,
    nombreFantasia: valores.nombreFantasia || undefined,
    cuit: valores.cuit || undefined,
    condicionIva: resolverEnum(valores.condicionIva ?? "", CONDICION_IVA),
    tipoConsumidor: resolverEnum(valores.tipoConsumidor ?? "", TIPO_CONSUMIDOR),
    email: valores.email || undefined,
    whatsapp: valores.whatsapp || undefined,
    telefonoAlternativo: valores.telefonoAlternativo || undefined,
    domicilioFiscal: valores.domicilioFiscal || undefined,
    provincia: valores.provincia || undefined,
    localidad: valores.localidad || undefined,
    codigoPostal: valores.codigoPostal || undefined,
    canalPreferido: valores.canalPreferido ? resolverEnum(valores.canalPreferido, CANAL_PREFERIDO) : undefined,
    condicionPago: valores.condicionPago || undefined,
    observaciones: valores.observaciones || undefined,
  };
}

export async function generarPlantillaClientes(): Promise<Buffer> {
  return generarPlantillaExcel("Clientes", CLIENTE_IMPORT_COLUMNS);
}

/**
 * Importa clientes desde un .xlsx. Cada fila se procesa como una llamada
 * independiente a `createCliente` (misma validación, permisos, unicidad de
 * CUIT y auditoría que el alta manual): una fila inválida no aborta el resto
 * del archivo, sólo queda registrada en el detalle de errores.
 */
export async function importarClientes(actor: TenantActor, buffer: ArrayBuffer | Buffer): Promise<ResumenImport> {
  const filas = await leerFilasExcel(buffer, CLIENTE_IMPORT_COLUMNS);

  const detalle: FilaImportResultado[] = [];
  let creados = 0;

  for (const { fila, valores } of filas) {
    try {
      // parseClienteRow entrega un objeto sin tipar campo por campo (viene de
      // texto de planilla); createCliente lo valida en runtime con el mismo
      // Zod schema que el alta manual, así que el cast acá es seguro.
      await createCliente(actor, parseClienteRow(valores) as CreateClienteInput);
      detalle.push({ fila, ok: true });
      creados++;
    } catch (err) {
      detalle.push({ fila, ok: false, mensaje: mensajeDeError(err) });
    }
  }

  return { creados, conError: detalle.length - creados, detalle };
}

function mensajeDeError(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => `${i.path.join(".") || "valor"}: ${i.message}`).join("; ");
  }
  if (err instanceof Error) return err.message;
  return "Error desconocido";
}

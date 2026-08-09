import { z } from "zod";
import { generarPlantillaExcel, leerFilasExcel, type FilaImportResultado, type ImportColumn, type ResumenImport } from "../import/excel";
import type { TenantActor } from "../clientes/service";
import { createMatafuego } from "./service";
import type { CreateMatafuegoInput } from "./schemas";

const TIPO = { portatil: "PORTATIL", rodante: "RODANTE", vehicular: "VEHICULAR", otro: "OTRO" } as const;
const AGENTE_EXTINTOR = {
  "polvo quimico abc": "POLVO_QUIMICO_ABC",
  "polvo quimico": "POLVO_QUIMICO_ABC",
  co2: "CO2",
  agua: "AGUA",
  espuma: "ESPUMA",
  "agente limpio": "AGENTE_LIMPIO",
  otro: "OTRO",
} as const;

const MATAFUEGO_IMPORT_COLUMNS: ImportColumn[] = [
  { header: "Código interno", key: "codigoInterno", width: 16, ejemplo: "MAT-0231" },
  { header: "N° de serie", key: "numeroSerie", width: 16, ejemplo: "AR-88342" },
  { header: "Código de barras (opcional)", key: "codigoBarras", width: 18 },
  { header: "Tipo", key: "tipo", width: 14, ejemplo: "Portátil", valoresPermitidos: ["Portátil", "Rodante", "Vehicular", "Otro"] },
  {
    header: "Agente extintor",
    key: "agenteExtintor",
    width: 20,
    ejemplo: "Polvo químico ABC",
    valoresPermitidos: ["Polvo químico ABC", "CO2", "Agua", "Espuma", "Agente limpio", "Otro"],
  },
  { header: "Capacidad nominal (opcional)", key: "capacidadNominal", width: 18, ejemplo: "5kg" },
  { header: "Marca (opcional)", key: "marca", width: 18 },
  { header: "Modelo (opcional)", key: "modelo", width: 18 },
  { header: "Fabricante (opcional)", key: "fabricante", width: 18 },
  { header: "Fecha de fabricación (opcional, AAAA-MM-DD)", key: "fechaFabricacion", width: 22 },
  { header: "Fecha de puesta en servicio (opcional, AAAA-MM-DD)", key: "fechaPuestaServicio", width: 26 },
  { header: "Peso nominal en kg (opcional)", key: "pesoNominal", width: 18 },
  { header: "Norma técnica (opcional)", key: "normaTecnica", width: 18 },
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
  return valor.trim().toUpperCase().replace(/\s+/g, "_");
}

function numeroOUndefined(valor: string): number | undefined {
  if (!valor) return undefined;
  const n = Number(valor.replace(",", "."));
  return Number.isNaN(n) ? NaN : n; // NaN se deja pasar a propósito: z.number() lo rechaza con un mensaje claro
}

function parseMatafuegoRow(valores: Record<string, string>, clienteId: string, establecimientoId: string): Record<string, unknown> {
  return {
    clienteId,
    establecimientoId,
    codigoInterno: valores.codigoInterno,
    numeroSerie: valores.numeroSerie,
    codigoBarras: valores.codigoBarras || undefined,
    tipo: resolverEnum(valores.tipo ?? "", TIPO),
    agenteExtintor: resolverEnum(valores.agenteExtintor ?? "", AGENTE_EXTINTOR),
    capacidadNominal: valores.capacidadNominal || undefined,
    marca: valores.marca || undefined,
    modelo: valores.modelo || undefined,
    fabricante: valores.fabricante || undefined,
    fechaFabricacion: valores.fechaFabricacion || undefined,
    fechaPuestaServicio: valores.fechaPuestaServicio || undefined,
    pesoNominal: numeroOUndefined(valores.pesoNominal ?? ""),
    normaTecnica: valores.normaTecnica || undefined,
    observaciones: valores.observaciones || undefined,
  };
}

export async function generarPlantillaMatafuegos(): Promise<Buffer> {
  return generarPlantillaExcel("Matafuegos", MATAFUEGO_IMPORT_COLUMNS);
}

/**
 * Importa el inventario de matafuegos de UN establecimiento puntual (mismo
 * criterio que el alta manual, que también se hace desde la ficha del
 * cliente/establecimiento): clienteId/establecimientoId vienen fijos por
 * contexto, no de la planilla, así la plantilla no necesita esas columnas y
 * no hay forma de que una fila termine en el establecimiento equivocado.
 */
export async function importarMatafuegos(
  actor: TenantActor,
  destino: { clienteId: string; establecimientoId: string },
  buffer: ArrayBuffer | Buffer,
): Promise<ResumenImport> {
  const filas = await leerFilasExcel(buffer, MATAFUEGO_IMPORT_COLUMNS);

  const detalle: FilaImportResultado[] = [];
  let creados = 0;

  for (const { fila, valores } of filas) {
    try {
      const input = parseMatafuegoRow(valores, destino.clienteId, destino.establecimientoId) as CreateMatafuegoInput;
      await createMatafuego(actor, input);
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

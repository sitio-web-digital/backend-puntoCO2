import ExcelJS from "exceljs";

/** Límites defensivos contra archivos abusivos (DoS por planillas gigantes). */
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_IMPORT_ROWS = 2000;

export class ArchivoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchivoInvalidoError";
  }
}

export interface ImportColumn {
  /** Encabezado exacto que se muestra/espera en la planilla. */
  header: string;
  /** Clave del objeto de fila resultante. */
  key: string;
  /** Ancho de columna sugerido para la plantilla generada. */
  width?: number;
  /** Valor de ejemplo para la fila de muestra de la plantilla. */
  ejemplo?: string;
  /** Lista de valores permitidos (para columnas enum), documentada en la hoja de ayuda. */
  valoresPermitidos?: readonly string[];
}

/** Lee la primera hoja de un .xlsx y devuelve filas como objetos `{ [column.key]: string }`, usando `columns[].header` para mapear encabezados (case/acentos-insensitive, orden libre). */
export async function leerFilasExcel(
  buffer: ArrayBuffer | Buffer,
  columns: ImportColumn[],
): Promise<{ fila: number; valores: Record<string, string> }[]> {
  if (buffer.byteLength > MAX_IMPORT_FILE_BYTES) {
    throw new ArchivoInvalidoError(`El archivo supera el tamaño máximo permitido (${MAX_IMPORT_FILE_BYTES / 1024 / 1024}MB).`);
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as ExcelJS.Buffer);
  } catch {
    throw new ArchivoInvalidoError("No se pudo leer el archivo. Verificá que sea un .xlsx válido.");
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ArchivoInvalidoError("El archivo no tiene ninguna hoja.");

  const headerRow = sheet.getRow(1);
  const headerIndexByKey = new Map<string, number>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const texto = normalizarEncabezado(cellText(cell.value));
    const column = columns.find((c) => normalizarEncabezado(c.header) === texto);
    if (column) headerIndexByKey.set(column.key, colNumber);
  });

  const faltantes = columns.filter((c) => c.header !== undefined).filter((c) => !headerIndexByKey.has(c.key));
  // Sólo las columnas realmente requeridas deben estar presentes; el resto (opcionales)
  // se resuelven como vacías si no aparecen en el archivo.
  const faltantesObligatorias = faltantes.filter((c) => !c.header.toLowerCase().includes("(opcional)"));
  if (faltantesObligatorias.length > 0) {
    throw new ArchivoInvalidoError(
      `Faltan columnas en el archivo: ${faltantesObligatorias.map((c) => c.header).join(", ")}. Descargá la plantilla actualizada.`,
    );
  }

  const filas: { fila: number; valores: Record<string, string> }[] = [];
  const totalRows = sheet.rowCount;
  for (let rowNumber = 2; rowNumber <= totalRows; rowNumber++) {
    if (filas.length >= MAX_IMPORT_ROWS) {
      throw new ArchivoInvalidoError(`El archivo tiene más de ${MAX_IMPORT_ROWS} filas de datos, el máximo admitido por importación.`);
    }
    const row = sheet.getRow(rowNumber);
    if (row.actualCellCount === 0) continue;

    const valores: Record<string, string> = {};
    let algunValor = false;
    for (const column of columns) {
      const colIndex = headerIndexByKey.get(column.key);
      const raw = colIndex ? cellText(row.getCell(colIndex).value).trim() : "";
      if (raw) algunValor = true;
      valores[column.key] = raw;
    }
    if (!algunValor) continue; // fila en blanco, se ignora silenciosamente

    filas.push({ fila: rowNumber, valores });
  }

  return filas;
}

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizarEncabezado(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .trim()
    .toLowerCase();
}

/** ExcelJS puede devolver string, number, Date, fórmulas ({formula,result}) o rich text; esto lo aplana a texto plano sin evaluar nada. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellText((value as { result: ExcelJS.CellValue }).result);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("");
    }
  }
  return String(value);
}

/** Genera un .xlsx de plantilla: hoja de datos con encabezados + fila de ejemplo, y una hoja de ayuda con los valores permitidos por columna. */
export async function generarPlantillaExcel(nombreHoja: string, columns: ImportColumn[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(nombreHoja);

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 22 }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F4F2" } };

  const ejemplo: Record<string, string> = {};
  for (const c of columns) ejemplo[c.key] = c.ejemplo ?? "";
  const filaEjemplo = sheet.addRow(ejemplo);
  filaEjemplo.font = { italic: true, color: { argb: "FF8A8A93" } };

  const conValores = columns.filter((c) => c.valoresPermitidos && c.valoresPermitidos.length > 0);
  if (conValores.length > 0) {
    const ayuda = workbook.addWorksheet("Valores permitidos");
    ayuda.columns = [
      { header: "Columna", key: "columna", width: 28 },
      { header: "Valores permitidos", key: "valores", width: 70 },
    ];
    ayuda.getRow(1).font = { bold: true };
    for (const c of conValores) {
      ayuda.addRow({ columna: c.header, valores: c.valoresPermitidos!.join(" | ") });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export interface FilaImportResultado {
  fila: number;
  ok: boolean;
  mensaje?: string;
}

export interface ResumenImport {
  creados: number;
  conError: number;
  detalle: FilaImportResultado[];
}

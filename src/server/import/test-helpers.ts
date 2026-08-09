import ExcelJS from "exceljs";

/** Sólo para tests: arma un buffer .xlsx en memoria a partir de encabezados + filas de texto plano. */
export async function buildXlsxBuffer(headers: string[], rows: string[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Datos");
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

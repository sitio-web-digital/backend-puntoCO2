/** Serializador CSV genérico (RF-26: "un formato seleccionado" — cubre
 * Excel, que abre CSV nativamente, sin sumar una dependencia nueva sólo para
 * esto). La generación de PDF queda fuera de este alcance: requiere elegir
 * una librería de renderizado (pdfkit, puppeteer, etc.), una decisión de
 * dependencia que no se toma implícitamente acá. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]!);
  const escapar = (valor: unknown): string => {
    if (valor === null || valor === undefined) return "";
    const texto = valor instanceof Date ? valor.toISOString() : String(valor);
    if (/[",\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
    return texto;
  };

  const lineas = [headers.join(","), ...rows.map((row) => headers.map((h) => escapar(row[h])).join(","))];
  return lineas.join("\n");
}

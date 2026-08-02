import { NextResponse } from "next/server";
import { toCsv } from "./csv";

/** z.coerce.date() acepta un string en tiempo de ejecución, pero su tipo
 * estático de entrada (z.input) sigue siendo `Date` en esta versión de Zod
 * — así que los query params (siempre `string`) se convierten acá antes de
 * pasarlos a las funciones de reporte, en vez de pelear con el tipo. */
export function parseFechaParam(value: string | null): Date | undefined {
  return value ? new Date(value) : undefined;
}

/** Sirve un reporte tabular en JSON (por defecto) o CSV (?formato=csv) —
 * RF-26: "dado un formato seleccionado, el archivo respeta el formato".
 * Sólo se ofrece para los reportes de listado plano (`datos`); los
 * agregados (agrupados, indicadores) se sirven sólo en JSON. */
export function responderReporteTabular(formato: string | null, cuerpo: { datos: Record<string, unknown>[] } & Record<string, unknown>, nombreArchivo: string): NextResponse {
  if (formato !== "csv") return NextResponse.json(cuerpo);

  const csv = toCsv(cuerpo.datos);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivo}.csv"`,
    },
  });
}

import { type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { reporteInspecciones } from "@/server/reportes/service";
import { responderReporteTabular, parseFechaParam } from "@/server/reportes/http";
import { handleApiError } from "@/server/http/error-response";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const params = request.nextUrl.searchParams;
    const reporte = await reporteInspecciones(actor, {
      desde: parseFechaParam(params.get("desde")),
      hasta: parseFechaParam(params.get("hasta")),
      clienteId: params.get("clienteId") ?? undefined,
      establecimientoId: params.get("establecimientoId") ?? undefined,
    });
    return responderReporteTabular(params.get("formato"), reporte, "inspecciones");
  } catch (err) {
    return handleApiError(err);
  }
}

import { type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { reporteUnidadesRetiradas } from "@/server/reportes/service";
import { responderReporteTabular, parseFechaParam } from "@/server/reportes/http";
import { handleApiError } from "@/server/http/error-response";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const params = request.nextUrl.searchParams;
    const reporte = await reporteUnidadesRetiradas(actor, { desde: parseFechaParam(params.get("desde")), hasta: parseFechaParam(params.get("hasta")) });
    return responderReporteTabular(params.get("formato"), reporte, "unidades-retiradas");
  } catch (err) {
    return handleApiError(err);
  }
}

import { type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { reporteUnidadesVencidas } from "@/server/reportes/service";
import { responderReporteTabular } from "@/server/reportes/http";
import { handleApiError } from "@/server/http/error-response";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const reporte = await reporteUnidadesVencidas(actor);
    return responderReporteTabular(request.nextUrl.searchParams.get("formato"), reporte, "unidades-vencidas");
  } catch (err) {
    return handleApiError(err);
  }
}

import { type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { reporteUnidadesProximasAVencer } from "@/server/reportes/service";
import { responderReporteTabular } from "@/server/reportes/http";
import { handleApiError } from "@/server/http/error-response";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const dias = request.nextUrl.searchParams.get("diasAnticipacion");
    const reporte = await reporteUnidadesProximasAVencer(actor, dias ? Number(dias) : undefined);
    return responderReporteTabular(request.nextUrl.searchParams.get("formato"), reporte, "unidades-proximas-a-vencer");
  } catch (err) {
    return handleApiError(err);
  }
}

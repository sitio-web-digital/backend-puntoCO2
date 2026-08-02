import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { reporteProductividadPorTecnico } from "@/server/reportes/service";
import { parseFechaParam } from "@/server/reportes/http";
import { handleApiError } from "@/server/http/error-response";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const params = request.nextUrl.searchParams;
    const reporte = await reporteProductividadPorTecnico(actor, {
      desde: parseFechaParam(params.get("desde")),
      hasta: parseFechaParam(params.get("hasta")),
    });
    return NextResponse.json(reporte);
  } catch (err) {
    return handleApiError(err);
  }
}

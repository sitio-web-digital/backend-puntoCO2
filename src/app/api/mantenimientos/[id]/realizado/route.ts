import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { marcarMantenimientoRealizado } from "@/server/mantenimientos/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const mantenimiento = await marcarMantenimientoRealizado(actor, id, {
      ...(typeof body?.fechaRealizacion === "string" ? { fechaRealizacion: new Date(body.fechaRealizacion) } : {}),
      ...(typeof body?.motivo === "string" ? { motivo: body.motivo } : {}),
    });
    return NextResponse.json({ mantenimiento });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { getMantenimiento, MantenimientoProgramadoNotFoundError } from "@/server/mantenimientos/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const mantenimiento = await getMantenimiento(actor, id);
    if (!mantenimiento) throw new MantenimientoProgramadoNotFoundError(id);
    return NextResponse.json({ mantenimiento });
  } catch (err) {
    return handleApiError(err);
  }
}

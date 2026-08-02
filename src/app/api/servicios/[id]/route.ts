import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { getServicio, updateServicio, ServicioNotFoundError } from "@/server/servicios/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const servicio = await getServicio(actor, id);
    if (!servicio) throw new ServicioNotFoundError(id);
    return NextResponse.json({ servicio });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json();
    const servicio = await updateServicio(actor, id, body);
    return NextResponse.json({ servicio });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { getOrdenTrabajo, updateOrdenTrabajo, OrdenTrabajoNotFoundError } from "@/server/ordenes-trabajo/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const orden = await getOrdenTrabajo(actor, id);
    if (!orden) throw new OrdenTrabajoNotFoundError(id);
    return NextResponse.json({ orden });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json();
    const orden = await updateOrdenTrabajo(actor, id, body);
    return NextResponse.json({ orden });
  } catch (err) {
    return handleApiError(err);
  }
}

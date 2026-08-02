import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { getUbicacion, updateUbicacion, darDeBajaUbicacion, UbicacionNotFoundError } from "@/server/sectores/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const ubicacion = await getUbicacion(actor, id);
    if (!ubicacion) throw new UbicacionNotFoundError(id);
    return NextResponse.json({ ubicacion });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json();
    const ubicacion = await updateUbicacion(actor, id, body);
    return NextResponse.json({ ubicacion });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const motivo = typeof body?.motivo === "string" ? body.motivo : undefined;
    const ubicacion = await darDeBajaUbicacion(actor, id, motivo);
    return NextResponse.json({ ubicacion });
  } catch (err) {
    return handleApiError(err);
  }
}

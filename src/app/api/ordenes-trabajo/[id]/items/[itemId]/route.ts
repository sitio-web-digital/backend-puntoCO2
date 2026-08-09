import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { quitarItemOrden, actualizarCantidadItemOrden } from "@/server/ordenes-trabajo/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id, itemId } = await params;
    const body = await request.json();
    const item = await actualizarCantidadItemOrden(actor, id, itemId, body);
    return NextResponse.json({ item });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id, itemId } = await params;
    const item = await quitarItemOrden(actor, id, itemId);
    return NextResponse.json({ item });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { getListaPrecio, updateListaPrecio, ListaPrecioNotFoundError } from "@/server/servicios/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const lista = await getListaPrecio(actor, id);
    if (!lista) throw new ListaPrecioNotFoundError(id);
    return NextResponse.json({ lista });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json();
    const lista = await updateListaPrecio(actor, id, body);
    return NextResponse.json({ lista });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { crearListaPrecio, listListasPrecio } from "@/server/servicios/service";
import { handleApiError } from "@/server/http/error-response";

export async function GET() {
  try {
    const actor = await requireTenantUser();
    const listas = await listListasPrecio(actor);
    return NextResponse.json({ listas });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const body = await request.json();
    const lista = await crearListaPrecio(actor, body);
    return NextResponse.json({ lista }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

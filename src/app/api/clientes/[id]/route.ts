import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { getCliente, updateCliente, darDeBajaCliente, ClienteNotFoundError } from "@/server/clientes/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const cliente = await getCliente(actor, id);
    if (!cliente) {
      // Sin permiso de alcance TODAS: no revelamos si el cliente existe o no.
      throw new ClienteNotFoundError(id);
    }
    return NextResponse.json({ cliente });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json();
    const cliente = await updateCliente(actor, id, body);
    return NextResponse.json({ cliente });
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
    const cliente = await darDeBajaCliente(actor, id, motivo);
    return NextResponse.json({ cliente });
  } catch (err) {
    return handleApiError(err);
  }
}

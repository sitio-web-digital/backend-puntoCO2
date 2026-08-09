import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { getUsuario, actualizarUsuario, UsuarioNotFoundError } from "@/server/usuarios/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const usuario = await getUsuario(actor, id);
    if (!usuario) throw new UsuarioNotFoundError(id);
    return NextResponse.json({ usuario });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json();
    const usuario = await actualizarUsuario(actor, id, body);
    return NextResponse.json({ usuario });
  } catch (err) {
    return handleApiError(err);
  }
}

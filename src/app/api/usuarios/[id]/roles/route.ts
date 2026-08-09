import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { asignarRoles } from "@/server/usuarios/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json();
    const usuario = await asignarRoles(actor, id, body);
    return NextResponse.json({ usuario });
  } catch (err) {
    return handleApiError(err);
  }
}

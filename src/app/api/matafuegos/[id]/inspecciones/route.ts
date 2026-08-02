import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { crearInspeccion, listInspecciones } from "@/server/inspecciones/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id: matafuegoId } = await params;
    const inspecciones = await listInspecciones(actor, { matafuegoId });
    return NextResponse.json({ inspecciones });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id: matafuegoId } = await params;
    const body = await request.json();
    const inspeccion = await crearInspeccion(actor, { ...body, matafuegoId });
    return NextResponse.json({ inspeccion }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

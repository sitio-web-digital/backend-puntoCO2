import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { crearNoConformidadDesdeInspeccion } from "@/server/no-conformidades/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id: inspeccionId } = await params;
    const body = await request.json();
    const noConformidad = await crearNoConformidadDesdeInspeccion(actor, inspeccionId, body);
    return NextResponse.json({ noConformidad }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

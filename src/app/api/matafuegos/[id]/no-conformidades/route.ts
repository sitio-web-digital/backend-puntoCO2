import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { crearNoConformidad, listNoConformidades } from "@/server/no-conformidades/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id: matafuegoId } = await params;
    const noConformidades = await listNoConformidades(actor, { matafuegoId });
    return NextResponse.json({ noConformidades });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id: matafuegoId } = await params;
    const body = await request.json();
    const noConformidad = await crearNoConformidad(actor, { ...body, matafuegoId });
    return NextResponse.json({ noConformidad }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { getInspeccion, InspeccionNotFoundError } from "@/server/inspecciones/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const inspeccion = await getInspeccion(actor, id);
    if (!inspeccion) throw new InspeccionNotFoundError(id);
    return NextResponse.json({ inspeccion });
  } catch (err) {
    return handleApiError(err);
  }
}

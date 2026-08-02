import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { getNoConformidad, NoConformidadNotFoundError } from "@/server/no-conformidades/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const noConformidad = await getNoConformidad(actor, id);
    if (!noConformidad) throw new NoConformidadNotFoundError(id);
    return NextResponse.json({ noConformidad });
  } catch (err) {
    return handleApiError(err);
  }
}

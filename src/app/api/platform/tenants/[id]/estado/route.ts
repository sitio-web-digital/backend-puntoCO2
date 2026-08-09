import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/server/auth/current-user";
import { cambiarEstadoTenantPlataforma } from "@/server/platform/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const body = await request.json();
    const motivo = typeof body?.motivo === "string" ? body.motivo : undefined;
    const tenant = await cambiarEstadoTenantPlataforma(actor, id, body?.estado, motivo);
    return NextResponse.json({ tenant });
  } catch (err) {
    return handleApiError(err);
  }
}

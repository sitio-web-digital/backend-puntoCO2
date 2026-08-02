import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { iniciarTratamiento } from "@/server/no-conformidades/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const motivo = typeof body?.motivo === "string" ? body.motivo : undefined;
    const noConformidad = await iniciarTratamiento(actor, id, motivo);
    return NextResponse.json({ noConformidad });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { cancelarRetiroEntrega } from "@/server/retiros-entregas/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const registro = await cancelarRetiroEntrega(actor, id, typeof body?.motivo === "string" ? body.motivo : "");
    return NextResponse.json({ registro });
  } catch (err) {
    return handleApiError(err);
  }
}

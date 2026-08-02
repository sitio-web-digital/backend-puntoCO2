import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { cancelarOrden } from "@/server/ordenes-trabajo/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const orden = await cancelarOrden(actor, id, typeof body?.motivo === "string" ? body.motivo : "");
    return NextResponse.json({ orden });
  } catch (err) {
    return handleApiError(err);
  }
}

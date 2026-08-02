import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { cancelarNotificacion } from "@/server/notificaciones/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const notificacion = await cancelarNotificacion(actor, id, typeof body?.motivo === "string" ? body.motivo : undefined);
    return NextResponse.json({ notificacion });
  } catch (err) {
    return handleApiError(err);
  }
}

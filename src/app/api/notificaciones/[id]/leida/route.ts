import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { marcarNotificacionLeida } from "@/server/notificaciones/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const notificacion = await marcarNotificacionLeida(actor, id);
    return NextResponse.json({ notificacion });
  } catch (err) {
    return handleApiError(err);
  }
}

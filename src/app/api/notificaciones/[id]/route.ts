import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { getNotificacion, NotificacionNotFoundError } from "@/server/notificaciones/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const notificacion = await getNotificacion(actor, id);
    if (!notificacion) throw new NotificacionNotFoundError(id);
    return NextResponse.json({ notificacion });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextResponse } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { procesarNotificacionesPendientes } from "@/server/notificaciones/service";
import { handleApiError } from "@/server/http/error-response";

/**
 * Procesa la cola de notificaciones pendientes (RF-19) mientras no exista un
 * cron real configurado en el despliegue. Reservado a alcance TODAS sobre
 * NOTIFICACIONES.
 */
export async function POST() {
  try {
    const actor = await requireTenantUser();
    const resultado = await procesarNotificacionesPendientes(actor);
    return NextResponse.json(resultado);
  } catch (err) {
    return handleApiError(err);
  }
}

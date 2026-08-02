import { NextResponse } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { escanearVencimientosYGenerarNotificaciones } from "@/server/notificaciones/service";
import { handleApiError } from "@/server/http/error-response";

/**
 * Dispara manualmente el escaneo de vencimientos (RF-19) mientras no exista
 * un cron real configurado en el despliegue (Vercel Cron, GitHub Actions
 * schedule, etc.). Reservado a alcance TODAS sobre NOTIFICACIONES.
 */
export async function POST() {
  try {
    const actor = await requireTenantUser();
    const resultado = await escanearVencimientosYGenerarNotificaciones(actor);
    return NextResponse.json(resultado);
  } catch (err) {
    return handleApiError(err);
  }
}

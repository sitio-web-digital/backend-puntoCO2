import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { listNotificaciones } from "@/server/notificaciones/service";
import { handleApiError } from "@/server/http/error-response";

const ESTADOS = ["PENDIENTE", "EN_PROCESO", "ENVIADA", "ENTREGADA", "LEIDA", "FALLIDA", "REINTENTO", "CANCELADA"] as const;
const EVENTOS = [
  "VENCIMIENTO_PROXIMO",
  "MATAFUEGO_VENCIDO",
  "MANTENIMIENTO_PROXIMO",
  "MANTENIMIENTO_ATRASADO",
  "PRUEBA_HIDRAULICA_PROXIMA",
  "PRESUPUESTO_ENVIADO",
  "PRESUPUESTO_PENDIENTE",
  "ORDEN_PROGRAMADA",
  "TECNICO_DEMORADO",
  "UNIDAD_RETIRADA",
  "UNIDAD_LISTA_PARA_ENTREGA",
  "REEMPLAZO_TEMPORAL_ATRASADO",
  "CERTIFICADO_EMITIDO",
  "FACTURA_EMITIDA",
  "FACTURA_VENCIDA",
  "STOCK_MINIMO",
  "ERROR_INTEGRACION",
] as const;

const filtrosQuerySchema = z.object({
  estado: z.enum(ESTADOS).optional(),
  evento: z.enum(EVENTOS).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const parsed = filtrosQuerySchema.parse({
      estado: request.nextUrl.searchParams.get("estado") ?? undefined,
      evento: request.nextUrl.searchParams.get("evento") ?? undefined,
    });
    const notificaciones = await listNotificaciones(actor, {
      ...(parsed.estado ? { estado: parsed.estado } : {}),
      ...(parsed.evento ? { evento: parsed.evento } : {}),
    });
    return NextResponse.json({ notificaciones });
  } catch (err) {
    return handleApiError(err);
  }
}

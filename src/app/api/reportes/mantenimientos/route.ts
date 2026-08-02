import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { reporteMantenimientos } from "@/server/reportes/service";
import { responderReporteTabular, parseFechaParam } from "@/server/reportes/http";
import { handleApiError } from "@/server/http/error-response";

const ESTADOS = ["PROGRAMADO", "REPROGRAMADO", "REALIZADO", "CANCELADO"] as const;
const TIPOS_SERVICIO = ["INSPECCION", "MANTENIMIENTO", "RECARGA", "PRUEBA_HIDRAULICA", "CAMBIO_AGENTE", "REPARACION", "RETIRO_ENTREGA", "OTRO"] as const;
const filtrosQuerySchema = z.object({
  estado: z.enum(ESTADOS).optional(),
  tipoServicio: z.enum(TIPOS_SERVICIO).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const params = request.nextUrl.searchParams;
    const parsed = filtrosQuerySchema.parse({
      estado: params.get("estado") ?? undefined,
      tipoServicio: params.get("tipoServicio") ?? undefined,
    });
    const reporte = await reporteMantenimientos(actor, {
      desde: parseFechaParam(params.get("desde")),
      hasta: parseFechaParam(params.get("hasta")),
      clienteId: params.get("clienteId") ?? undefined,
      establecimientoId: params.get("establecimientoId") ?? undefined,
      ...(parsed.estado ? { estado: parsed.estado } : {}),
      ...(parsed.tipoServicio ? { tipoServicio: parsed.tipoServicio } : {}),
    });
    return responderReporteTabular(params.get("formato"), reporte, "mantenimientos");
  } catch (err) {
    return handleApiError(err);
  }
}

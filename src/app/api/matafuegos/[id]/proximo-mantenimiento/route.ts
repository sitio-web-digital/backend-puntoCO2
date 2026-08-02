import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { calcularProximoMantenimiento } from "@/server/mantenimientos/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const TIPO_SERVICIO = ["INSPECCION", "MANTENIMIENTO", "RECARGA", "PRUEBA_HIDRAULICA", "CAMBIO_AGENTE", "REPARACION", "RETIRO_ENTREGA", "OTRO"] as const;
const querySchema = z.object({ tipoServicio: z.enum(TIPO_SERVICIO) });

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id: matafuegoId } = await params;
    const { tipoServicio } = querySchema.parse({ tipoServicio: request.nextUrl.searchParams.get("tipoServicio") ?? undefined });
    const resultado = await calcularProximoMantenimiento(actor, matafuegoId, tipoServicio);
    return NextResponse.json(resultado ?? { regla: null, proximaFecha: null });
  } catch (err) {
    return handleApiError(err);
  }
}

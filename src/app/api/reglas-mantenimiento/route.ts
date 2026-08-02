import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { crearReglaMantenimiento, listReglasMantenimiento } from "@/server/mantenimientos/service";
import { handleApiError } from "@/server/http/error-response";

const TIPO_SERVICIO = ["INSPECCION", "MANTENIMIENTO", "RECARGA", "PRUEBA_HIDRAULICA", "CAMBIO_AGENTE", "REPARACION", "RETIRO_ENTREGA", "OTRO"] as const;
const filtrosQuerySchema = z.object({ tipoServicio: z.enum(TIPO_SERVICIO).optional() });

export async function GET(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const parsed = filtrosQuerySchema.parse({ tipoServicio: request.nextUrl.searchParams.get("tipoServicio") ?? undefined });
    const reglas = await listReglasMantenimiento(actor, parsed.tipoServicio ? { tipoServicio: parsed.tipoServicio } : {});
    return NextResponse.json({ reglas });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const body = await request.json();
    const regla = await crearReglaMantenimiento(actor, body);
    return NextResponse.json({ regla }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { crearServicio, listServicios } from "@/server/servicios/service";
import { handleApiError } from "@/server/http/error-response";

const CATEGORIA = [
  "RECARGA",
  "PRUEBA_HIDRAULICA",
  "PINTURA",
  "REPARACION",
  "CAMBIO_AGENTE",
  "INSPECCION",
  "MANTENIMIENTO",
  "REEMPLAZO_REPUESTOS",
  "VENTA",
  "INSTALACION",
  "RETIRO_ENTREGA",
  "OTRO",
] as const;

const filtrosQuerySchema = z.object({
  estado: z.enum(["ACTIVO", "INACTIVO"]).optional(),
  categoria: z.enum(CATEGORIA).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const parsed = filtrosQuerySchema.parse({
      estado: request.nextUrl.searchParams.get("estado") ?? undefined,
      categoria: request.nextUrl.searchParams.get("categoria") ?? undefined,
    });
    const servicios = await listServicios(actor, {
      ...(parsed.estado ? { estado: parsed.estado } : {}),
      ...(parsed.categoria ? { categoria: parsed.categoria } : {}),
    });
    return NextResponse.json({ servicios });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const body = await request.json();
    const servicio = await crearServicio(actor, body);
    return NextResponse.json({ servicio }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

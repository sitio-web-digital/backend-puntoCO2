import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { crearOrdenTrabajo, listOrdenesTrabajo } from "@/server/ordenes-trabajo/service";
import { handleApiError } from "@/server/http/error-response";

const ESTADOS = [
  "BORRADOR",
  "PENDIENTE_DE_APROBACION",
  "PROGRAMADA",
  "ASIGNADA",
  "EN_CAMINO",
  "EN_PROCESO",
  "PAUSADA",
  "FINALIZADA",
  "ENTREGADA",
  "CANCELADA",
  "FACTURADA",
] as const;

const filtrosQuerySchema = z.object({
  estado: z.enum(ESTADOS).optional(),
  clienteId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const parsed = filtrosQuerySchema.parse({
      estado: request.nextUrl.searchParams.get("estado") ?? undefined,
      clienteId: request.nextUrl.searchParams.get("clienteId") ?? undefined,
    });
    const ordenes = await listOrdenesTrabajo(actor, {
      ...(parsed.estado ? { estado: parsed.estado } : {}),
      ...(parsed.clienteId ? { clienteId: parsed.clienteId } : {}),
    });
    return NextResponse.json({ ordenes });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const body = await request.json();
    const orden = await crearOrdenTrabajo(actor, body);
    return NextResponse.json({ orden }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

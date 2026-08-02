import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { createMatafuego, listMatafuegos } from "@/server/matafuegos/service";
import { handleApiError } from "@/server/http/error-response";

const ESTADOS = [
  "INSTALADO",
  "PENDIENTE_DE_CONTROL",
  "APTO",
  "OBSERVADO",
  "VENCIDO",
  "RETIRADO",
  "EN_TRASLADO",
  "EN_TALLER",
  "EN_RECARGA",
  "EN_PRUEBA_HIDRAULICA",
  "RECHAZADO",
  "FUERA_DE_SERVICIO",
  "ENTREGADO",
  "DADO_DE_BAJA",
  "EXTRAVIADO",
] as const;

const filtrosQuerySchema = z.object({
  estado: z.enum(ESTADOS).optional(),
  clienteId: z.string().optional(),
  establecimientoId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const parsed = filtrosQuerySchema.parse({
      estado: request.nextUrl.searchParams.get("estado") ?? undefined,
      clienteId: request.nextUrl.searchParams.get("clienteId") ?? undefined,
      establecimientoId: request.nextUrl.searchParams.get("establecimientoId") ?? undefined,
    });
    const matafuegos = await listMatafuegos(actor, {
      ...(parsed.estado ? { estado: parsed.estado } : {}),
      ...(parsed.clienteId ? { clienteId: parsed.clienteId } : {}),
      ...(parsed.establecimientoId ? { establecimientoId: parsed.establecimientoId } : {}),
    });
    return NextResponse.json({ matafuegos });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const body = await request.json();
    const matafuego = await createMatafuego(actor, body);
    return NextResponse.json({ matafuego }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { registrarRetiro, listRetirosEntregas } from "@/server/retiros-entregas/service";
import { handleApiError } from "@/server/http/error-response";

const ESTADOS = ["RETIRADO", "EN_TRASLADO", "EN_TALLER", "ENTREGADO", "CANCELADO"] as const;

const filtrosQuerySchema = z.object({
  estado: z.enum(ESTADOS).optional(),
  matafuegoId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const parsed = filtrosQuerySchema.parse({
      estado: request.nextUrl.searchParams.get("estado") ?? undefined,
      matafuegoId: request.nextUrl.searchParams.get("matafuegoId") ?? undefined,
    });
    const registros = await listRetirosEntregas(actor, {
      ...(parsed.estado ? { estado: parsed.estado } : {}),
      ...(parsed.matafuegoId ? { matafuegoId: parsed.matafuegoId } : {}),
    });
    return NextResponse.json({ registros });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const body = await request.json();
    const registro = await registrarRetiro(actor, body);
    return NextResponse.json({ registro }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

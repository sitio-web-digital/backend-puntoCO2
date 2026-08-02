import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { listMantenimientos } from "@/server/mantenimientos/service";
import { handleApiError } from "@/server/http/error-response";

const ESTADOS = ["PROGRAMADO", "REPROGRAMADO", "REALIZADO", "CANCELADO"] as const;
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
    const mantenimientos = await listMantenimientos(actor, {
      ...(parsed.estado ? { estado: parsed.estado } : {}),
      ...(parsed.matafuegoId ? { matafuegoId: parsed.matafuegoId } : {}),
    });
    return NextResponse.json({ mantenimientos });
  } catch (err) {
    return handleApiError(err);
  }
}

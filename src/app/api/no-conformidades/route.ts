import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { listNoConformidades } from "@/server/no-conformidades/service";
import { handleApiError } from "@/server/http/error-response";

const ESTADOS = ["ABIERTA", "ASIGNADA", "EN_TRATAMIENTO", "RESUELTA", "VERIFICADA", "CERRADA", "DESCARTADA"] as const;
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
    const noConformidades = await listNoConformidades(actor, {
      ...(parsed.estado ? { estado: parsed.estado } : {}),
      ...(parsed.matafuegoId ? { matafuegoId: parsed.matafuegoId } : {}),
    });
    return NextResponse.json({ noConformidades });
  } catch (err) {
    return handleApiError(err);
  }
}

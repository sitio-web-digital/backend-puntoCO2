import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/server/auth/current-user";
import { listTicketsPlataforma } from "@/server/soporte/service";
import { handleApiError } from "@/server/http/error-response";

const estadoQuerySchema = z.enum(["ABIERTO", "EN_PROGRESO", "RESUELTO", "CERRADO"]).optional();

export async function GET(request: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const estado = estadoQuerySchema.parse(request.nextUrl.searchParams.get("estado") ?? undefined);
    const page = request.nextUrl.searchParams.get("page");
    const tickets = await listTicketsPlataforma(actor, {
      ...(estado ? { estado } : {}),
      ...(page ? { page: Number(page) } : {}),
    });
    return NextResponse.json(tickets);
  } catch (err) {
    return handleApiError(err);
  }
}

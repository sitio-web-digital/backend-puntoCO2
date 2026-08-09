import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { crearTicket, listTicketsDeTenantPaginado } from "@/server/soporte/service";
import { handleApiError } from "@/server/http/error-response";

const estadoQuerySchema = z.enum(["ABIERTO", "EN_PROGRESO", "RESUELTO", "CERRADO"]).optional();

export async function GET(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const estado = estadoQuerySchema.parse(request.nextUrl.searchParams.get("estado") ?? undefined);
    const page = request.nextUrl.searchParams.get("page");
    const tickets = await listTicketsDeTenantPaginado(actor, {
      ...(estado ? { estado } : {}),
      ...(page ? { page: Number(page) } : {}),
    });
    return NextResponse.json(tickets);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const body = await request.json();
    const ticket = await crearTicket(actor, body);
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

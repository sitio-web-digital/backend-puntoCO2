import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/server/auth/current-user";
import { responderTicketPlataforma } from "@/server/soporte/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const body = await request.json();
    const ticket = await responderTicketPlataforma(actor, id, body?.cuerpo);
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

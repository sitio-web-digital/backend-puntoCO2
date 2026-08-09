import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { responderTicket } from "@/server/soporte/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json();
    const ticket = await responderTicket(actor, id, body?.cuerpo);
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

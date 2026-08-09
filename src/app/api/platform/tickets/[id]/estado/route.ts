import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/server/auth/current-user";
import { cambiarEstadoTicketPlataforma } from "@/server/soporte/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const body = await request.json();
    const ticket = await cambiarEstadoTicketPlataforma(actor, id, body?.estado);
    return NextResponse.json({ ticket });
  } catch (err) {
    return handleApiError(err);
  }
}

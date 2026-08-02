import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { moverMatafuego } from "@/server/matafuegos/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json();
    const matafuego = await moverMatafuego(actor, id, body);
    return NextResponse.json({ matafuego });
  } catch (err) {
    return handleApiError(err);
  }
}

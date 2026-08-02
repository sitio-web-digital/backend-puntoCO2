import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { listMovimientosDeMatafuego } from "@/server/matafuegos/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const movimientos = await listMovimientosDeMatafuego(actor, id);
    return NextResponse.json({ movimientos });
  } catch (err) {
    return handleApiError(err);
  }
}

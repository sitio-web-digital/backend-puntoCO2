import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { regenerarQrMatafuego } from "@/server/qr/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const motivo = typeof body?.motivo === "string" ? body.motivo : undefined;
    const matafuego = await regenerarQrMatafuego(actor, id, motivo);
    return NextResponse.json({ matafuego });
  } catch (err) {
    return handleApiError(err);
  }
}

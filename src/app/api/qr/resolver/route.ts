import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { resolveMatafuegoParaEscaneo } from "@/server/qr/service";
import { handleApiError } from "@/server/http/error-response";

/** Usado por el escáner in-app (celular ya logueado): resuelve el token del
 * QR directo al id interno del matafuego, sin pasar por la vista pública. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireTenantUser();
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "invalid_input", message: "Falta el token del QR." }, { status: 400 });
    }
    const { matafuegoId } = await resolveMatafuegoParaEscaneo({ tenantId: user.tenantId, usuarioId: user.usuarioId }, token);
    return NextResponse.json({ matafuegoId });
  } catch (err) {
    return handleApiError(err);
  }
}

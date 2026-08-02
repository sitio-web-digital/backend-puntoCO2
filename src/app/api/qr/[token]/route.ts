import { NextResponse, type NextRequest } from "next/server";
import { resolveQrPublico } from "@/server/qr/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/** Sin autenticación a propósito (RF-05): cualquiera que escanee el QR físico
 * debe poder ver el estado/vigencia de la unidad sin loguearse. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    const vista = await resolveQrPublico(token);
    return NextResponse.json(vista);
  } catch (err) {
    return handleApiError(err);
  }
}

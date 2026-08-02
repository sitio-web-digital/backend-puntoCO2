import { NextResponse, type NextRequest } from "next/server";
import { resolverCertificadoPublico } from "@/server/certificados/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/** Sin autenticación a propósito (RF-17): quien escanea el QR de un
 * certificado impreso debe poder verificar su estado sin loguearse. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    const vista = await resolverCertificadoPublico(token);
    return NextResponse.json(vista);
  } catch (err) {
    return handleApiError(err);
  }
}

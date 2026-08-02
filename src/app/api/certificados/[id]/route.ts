import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { getCertificado, CertificadoNotFoundError } from "@/server/certificados/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const certificado = await getCertificado(actor, id);
    if (!certificado) throw new CertificadoNotFoundError(id);
    return NextResponse.json({ certificado });
  } catch (err) {
    return handleApiError(err);
  }
}

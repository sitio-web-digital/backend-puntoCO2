import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { reemplazarCertificado } from "@/server/certificados/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json();
    const resultado = await reemplazarCertificado(actor, id, body);
    return NextResponse.json(resultado, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

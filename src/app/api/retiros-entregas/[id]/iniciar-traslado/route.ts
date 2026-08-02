import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { iniciarTraslado } from "@/server/retiros-entregas/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const registro = await iniciarTraslado(actor, id);
    return NextResponse.json({ registro });
  } catch (err) {
    return handleApiError(err);
  }
}

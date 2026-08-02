import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { getRetiroEntrega, RetiroEntregaNotFoundError } from "@/server/retiros-entregas/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const registro = await getRetiroEntrega(actor, id);
    if (!registro) throw new RetiroEntregaNotFoundError(id);
    return NextResponse.json({ registro });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { entregarOrden } from "@/server/ordenes-trabajo/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const orden = await entregarOrden(actor, id);
    return NextResponse.json({ orden });
  } catch (err) {
    return handleApiError(err);
  }
}

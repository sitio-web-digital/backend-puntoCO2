import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { resolverPrecioVigente } from "@/server/servicios/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const listaPrecioId = request.nextUrl.searchParams.get("listaPrecioId") ?? undefined;
    const precio = await resolverPrecioVigente(actor, id, listaPrecioId);
    return NextResponse.json({ precio });
  } catch (err) {
    return handleApiError(err);
  }
}

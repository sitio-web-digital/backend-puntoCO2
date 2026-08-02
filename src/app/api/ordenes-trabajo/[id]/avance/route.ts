import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { registrarAvanceTecnico } from "@/server/ordenes-trabajo/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json();
    const orden = await registrarAvanceTecnico(actor, id, body);
    return NextResponse.json({ orden });
  } catch (err) {
    return handleApiError(err);
  }
}

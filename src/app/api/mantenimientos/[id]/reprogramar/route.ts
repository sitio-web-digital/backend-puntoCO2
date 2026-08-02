import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { reprogramarMantenimiento } from "@/server/mantenimientos/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json();
    const mantenimiento = await reprogramarMantenimiento(actor, id, body);
    return NextResponse.json({ mantenimiento });
  } catch (err) {
    return handleApiError(err);
  }
}

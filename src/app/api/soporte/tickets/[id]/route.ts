import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { getTicketDeTenant } from "@/server/soporte/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const ticket = await getTicketDeTenant(actor, id);
    return NextResponse.json({ ticket });
  } catch (err) {
    return handleApiError(err);
  }
}

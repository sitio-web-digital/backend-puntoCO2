import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/server/auth/current-user";
import { getTenantPlataforma, actualizarWhatsappTenant } from "@/server/platform/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const tenant = await getTenantPlataforma(actor, id);
    return NextResponse.json({ tenant });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const whatsappFromNumber = typeof body?.whatsappFromNumber === "string" ? body.whatsappFromNumber : null;
    const tenant = await actualizarWhatsappTenant(actor, id, whatsappFromNumber);
    return NextResponse.json({ tenant });
  } catch (err) {
    return handleApiError(err);
  }
}

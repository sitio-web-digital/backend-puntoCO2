import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { getSector, updateSector, darDeBajaSector, SectorNotFoundError } from "@/server/sectores/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const sector = await getSector(actor, id);
    if (!sector) throw new SectorNotFoundError(id);
    return NextResponse.json({ sector });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json();
    const sector = await updateSector(actor, id, body);
    return NextResponse.json({ sector });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const motivo = typeof body?.motivo === "string" ? body.motivo : undefined;
    const sector = await darDeBajaSector(actor, id, motivo);
    return NextResponse.json({ sector });
  } catch (err) {
    return handleApiError(err);
  }
}

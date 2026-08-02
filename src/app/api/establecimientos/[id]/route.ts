import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { getEstablecimiento, updateEstablecimiento, darDeBajaEstablecimiento, EstablecimientoNotFoundError } from "@/server/establecimientos/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const establecimiento = await getEstablecimiento(actor, id);
    if (!establecimiento) {
      // Sin permiso de alcance TODAS: no revelamos si el establecimiento existe.
      throw new EstablecimientoNotFoundError(id);
    }
    return NextResponse.json({ establecimiento });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = await request.json();
    const establecimiento = await updateEstablecimiento(actor, id, body);
    return NextResponse.json({ establecimiento });
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
    const establecimiento = await darDeBajaEstablecimiento(actor, id, motivo);
    return NextResponse.json({ establecimiento });
  } catch (err) {
    return handleApiError(err);
  }
}

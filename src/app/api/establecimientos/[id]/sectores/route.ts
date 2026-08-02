import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { createSector, listSectoresDeEstablecimiento } from "@/server/sectores/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const estadoQuerySchema = z.enum(["ACTIVO", "SUSPENDIDO", "DADO_DE_BAJA"]).optional();

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id: establecimientoId } = await params;
    const estado = estadoQuerySchema.parse(request.nextUrl.searchParams.get("estado") ?? undefined);
    const sectores = await listSectoresDeEstablecimiento(actor, establecimientoId, estado ? { estado } : {});
    return NextResponse.json({ sectores });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id: establecimientoId } = await params;
    const body = await request.json();
    const sector = await createSector(actor, { ...body, establecimientoId });
    return NextResponse.json({ sector }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

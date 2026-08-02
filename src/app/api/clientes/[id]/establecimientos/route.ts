import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { createEstablecimiento, listEstablecimientosDeCliente } from "@/server/establecimientos/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const estadoQuerySchema = z.enum(["ACTIVO", "SUSPENDIDO", "DADO_DE_BAJA"]).optional();

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id: clienteId } = await params;
    const estado = estadoQuerySchema.parse(request.nextUrl.searchParams.get("estado") ?? undefined);
    const establecimientos = await listEstablecimientosDeCliente(actor, clienteId, estado ? { estado } : {});
    return NextResponse.json({ establecimientos });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id: clienteId } = await params;
    const body = await request.json();
    const establecimiento = await createEstablecimiento(actor, { ...body, clienteId });
    return NextResponse.json({ establecimiento }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

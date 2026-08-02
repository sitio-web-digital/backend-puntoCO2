import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { createCliente, listClientes } from "@/server/clientes/service";
import { handleApiError } from "@/server/http/error-response";

const estadoQuerySchema = z.enum(["ACTIVO", "SUSPENDIDO", "DADO_DE_BAJA"]).optional();

export async function GET(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const estado = estadoQuerySchema.parse(request.nextUrl.searchParams.get("estado") ?? undefined);
    const clientes = await listClientes(actor, estado ? { estado } : {});
    return NextResponse.json({ clientes });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const body = await request.json();
    const cliente = await createCliente(actor, body);
    return NextResponse.json({ cliente }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

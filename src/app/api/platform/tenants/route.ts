import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/server/auth/current-user";
import { listTenantsPlataforma, crearTenantPlataforma } from "@/server/platform/service";
import { handleApiError } from "@/server/http/error-response";

const estadoQuerySchema = z.enum(["TRIAL", "ACTIVO", "SUSPENDIDO", "VENCIDO", "CANCELADO"]).optional();

export async function GET(request: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const estado = estadoQuerySchema.parse(request.nextUrl.searchParams.get("estado") ?? undefined);
    const page = request.nextUrl.searchParams.get("page");
    const tenants = await listTenantsPlataforma(actor, {
      ...(estado ? { estado } : {}),
      ...(page ? { page: Number(page) } : {}),
    });
    return NextResponse.json(tenants);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const body = await request.json();
    const { tenant, usuarioAdmin } = await crearTenantPlataforma(actor, body);
    return NextResponse.json({ tenant, usuarioAdmin }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

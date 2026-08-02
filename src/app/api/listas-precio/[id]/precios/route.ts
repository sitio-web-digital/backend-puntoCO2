import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { fijarPrecio } from "@/server/servicios/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  servicioId: z.string().min(1, "servicioId es obligatorio"),
  precio: z.number().nonnegative(),
  vigenteDesde: z.coerce.date().optional(),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const { servicioId, ...resto } = body;
    const precio = await fijarPrecio(actor, id, servicioId, resto);
    return NextResponse.json({ precio }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

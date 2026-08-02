import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { crearMantenimientoProgramado, crearMantenimientoDesdeRegla, listMantenimientos } from "@/server/mantenimientos/service";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const TIPO_SERVICIO = ["INSPECCION", "MANTENIMIENTO", "RECARGA", "PRUEBA_HIDRAULICA", "CAMBIO_AGENTE", "REPARACION", "RETIRO_ENTREGA", "OTRO"] as const;
const PRIORIDAD = ["BAJA", "MEDIA", "ALTA", "URGENTE"] as const;

// Dos formas de crear un mantenimiento: con fecha explícita (POST normal), o
// pidiéndole al motor de reglas que la calcule (`usarRegla: true`). Se
// modelan como variantes separadas en vez de un solo schema laxo, así no hace
// falta castear nada para pasarle los datos a cada función del servicio.
const desdeReglaSchema = z.object({
  usarRegla: z.literal(true),
  tipoServicio: z.enum(TIPO_SERVICIO),
  tecnicoAsignadoId: z.string().trim().min(1).optional(),
  prioridad: z.enum(PRIORIDAD).optional(),
  observaciones: z.string().trim().max(2000).optional(),
});

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id: matafuegoId } = await params;
    const mantenimientos = await listMantenimientos(actor, { matafuegoId });
    return NextResponse.json({ mantenimientos });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id: matafuegoId } = await params;
    const body = await request.json();

    const desdeRegla = desdeReglaSchema.safeParse(body);
    if (desdeRegla.success) {
      const { tipoServicio, tecnicoAsignadoId, prioridad, observaciones } = desdeRegla.data;
      const mantenimiento = await crearMantenimientoDesdeRegla(actor, matafuegoId, tipoServicio, {
        ...(tecnicoAsignadoId ? { tecnicoAsignadoId } : {}),
        ...(prioridad ? { prioridad } : {}),
        ...(observaciones ? { observaciones } : {}),
      });
      return NextResponse.json({ mantenimiento }, { status: 201 });
    }

    const mantenimiento = await crearMantenimientoProgramado(actor, { ...body, matafuegoId });
    return NextResponse.json({ mantenimiento }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

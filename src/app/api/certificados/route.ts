import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantUser } from "@/server/auth/current-user";
import { emitirCertificado, listCertificados } from "@/server/certificados/service";
import { handleApiError } from "@/server/http/error-response";

const ESTADOS = ["BORRADOR", "EMITIDO", "VIGENTE", "ANULADO", "REEMPLAZADO"] as const;
const TIPOS = [
  "CERTIFICADO_MANTENIMIENTO",
  "CERTIFICADO_RECARGA",
  "INFORME_INSPECCION",
  "ACTA_RETIRO",
  "ACTA_ENTREGA",
  "INFORME_PRUEBA_HIDRAULICA",
  "CONSTANCIA_NO_CONFORMIDAD",
  "PLANILLA_DOTACION",
  "HISTORIAL_TECNICO",
  "CERTIFICADO_BAJA",
] as const;

const filtrosQuerySchema = z.object({
  estado: z.enum(ESTADOS).optional(),
  clienteId: z.string().optional(),
  tipo: z.enum(TIPOS).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const parsed = filtrosQuerySchema.parse({
      estado: request.nextUrl.searchParams.get("estado") ?? undefined,
      clienteId: request.nextUrl.searchParams.get("clienteId") ?? undefined,
      tipo: request.nextUrl.searchParams.get("tipo") ?? undefined,
    });
    const certificados = await listCertificados(actor, {
      ...(parsed.estado ? { estado: parsed.estado } : {}),
      ...(parsed.clienteId ? { clienteId: parsed.clienteId } : {}),
      ...(parsed.tipo ? { tipo: parsed.tipo } : {}),
    });
    return NextResponse.json({ certificados });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireTenantUser();
    const body = await request.json();
    const certificado = await emitirCertificado(actor, body);
    return NextResponse.json({ certificado }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

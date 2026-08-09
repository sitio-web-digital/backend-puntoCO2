import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { getEstablecimiento } from "@/server/establecimientos/service";
import { importarMatafuegos } from "@/server/matafuegos/import";
import { ArchivoInvalidoError } from "@/server/import/excel";
import { handleApiError } from "@/server/http/error-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireTenantUser();
    const { id: establecimientoId } = await params;

    // El clienteId sale del propio establecimiento (server-side), nunca del
    // cliente HTTP: así ninguna fila puede terminar asociada a otro cliente.
    const establecimiento = await getEstablecimiento(actor, establecimientoId);
    if (!establecimiento) {
      throw new ArchivoInvalidoError("El establecimiento no existe o no pertenece a esta empresa.");
    }

    const formData = await request.formData();
    const file = formData.get("archivo");
    if (!(file instanceof File)) {
      throw new ArchivoInvalidoError("Falta el archivo a importar.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const resumen = await importarMatafuegos(actor, { clienteId: establecimiento.clienteId, establecimientoId }, buffer);
    return NextResponse.json(resumen);
  } catch (err) {
    return handleApiError(err);
  }
}

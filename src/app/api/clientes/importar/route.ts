import { NextResponse, type NextRequest } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { importarClientes } from "@/server/clientes/import";
import { ArchivoInvalidoError } from "@/server/import/excel";
import { handleApiError } from "@/server/http/error-response";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireTenantUser();

    const formData = await request.formData();
    const file = formData.get("archivo");
    if (!(file instanceof File)) {
      throw new ArchivoInvalidoError("Falta el archivo a importar.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const resumen = await importarClientes(actor, buffer);
    return NextResponse.json(resumen);
  } catch (err) {
    return handleApiError(err);
  }
}

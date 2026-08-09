import { NextResponse } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { generarPlantillaClientes } from "@/server/clientes/import";
import { handleApiError } from "@/server/http/error-response";

export async function GET() {
  try {
    await requireTenantUser();
    const buffer = await generarPlantillaClientes();
    return new NextResponse(new Blob([Uint8Array.from(buffer)]), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla-clientes.xlsx"',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

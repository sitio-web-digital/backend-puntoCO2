import { NextResponse } from "next/server";
import { requireTenantUser } from "@/server/auth/current-user";
import { listRoles } from "@/server/usuarios/service";
import { handleApiError } from "@/server/http/error-response";

export async function GET() {
  try {
    const actor = await requireTenantUser();
    const roles = await listRoles(actor);
    return NextResponse.json({ roles });
  } catch (err) {
    return handleApiError(err);
  }
}

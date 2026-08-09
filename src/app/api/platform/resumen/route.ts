import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/server/auth/current-user";
import { resumenPlataforma } from "@/server/platform/service";
import { handleApiError } from "@/server/http/error-response";

export async function GET() {
  try {
    await requireSuperAdmin();
    const resumen = await resumenPlataforma();
    return NextResponse.json(resumen);
  } catch (err) {
    return handleApiError(err);
  }
}

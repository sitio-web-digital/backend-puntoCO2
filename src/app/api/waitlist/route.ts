import { NextResponse, type NextRequest } from "next/server";
import { anotarseWaitlist } from "@/server/waitlist/service";
import { handleApiError } from "@/server/http/error-response";

/** Ruta pública (landing /home), sin autenticación: cualquiera puede
 * anotarse con su email antes del lanzamiento. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await anotarseWaitlist(body);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

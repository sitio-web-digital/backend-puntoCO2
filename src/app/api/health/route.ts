import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";

/** Healthcheck para el deploy self-hosted (ver .github/workflows/deploy-backend.yml):
 * confirma que el proceso responde y que puede hablar con la base, no sólo
 * que Next.js levantó. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("healthcheck: fallo al conectar con la base", err);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}

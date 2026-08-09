import { headers } from "next/headers";

/** Arma el origin absoluto de la request actual (esquema + host) para
 * construir URLs pensadas para salir del sistema (QR impreso, links en
 * emails, etc.), sin depender de una env var que haya que mantener
 * sincronizada por ambiente (local/staging/producción). */
export async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

import { randomBytes } from "node:crypto";

/** 128 bits de entropía: no necesita ser secreto (va impreso en una etiqueta
 * física), pero sí no-adivinable, para que este endpoint público no se pueda
 * barrer probando tokens y encontrar matafuegos de otros tenants. */
export function generateQrToken(): string {
  return randomBytes(16).toString("base64url");
}

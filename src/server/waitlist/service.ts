import { prisma } from "../db/client";
import { anotarseWaitlistSchema, type AnotarseWaitlistInput } from "./schemas";

/** Alta en la lista de espera de la landing pública. Idempotente: anotarse
 * dos veces con el mismo email no es un error, sigue en la lista una vez. */
export async function anotarseWaitlist(rawInput: AnotarseWaitlistInput): Promise<void> {
  const input = anotarseWaitlistSchema.parse(rawInput);
  await prisma.waitlistLead.upsert({
    where: { email: input.email },
    update: {},
    create: { email: input.email },
  });
}

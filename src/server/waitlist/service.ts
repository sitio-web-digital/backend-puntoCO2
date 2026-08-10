import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { paginationArgs, toPaginatedResult, type PaginationParams } from "../db/pagination";
import type { PlatformActor } from "../platform/service";
import { anotarseWaitlistSchema, type AnotarseWaitlistInput } from "./schemas";

/** Alta en la lista de espera de la landing pública. Idempotente: anotarse
 * de nuevo con el mismo email no es un error, actualiza el teléfono en vez
 * de duplicar la fila. */
export async function anotarseWaitlist(rawInput: AnotarseWaitlistInput): Promise<void> {
  const input = anotarseWaitlistSchema.parse(rawInput);
  await prisma.waitlistLead.upsert({
    where: { email: input.email },
    update: { telefono: input.telefono },
    create: { email: input.email, telefono: input.telefono },
  });
}

/** Lado plataforma (superadmin SaaS): quién se fue anotando a la lista de
 * espera, para hacer seguimiento comercial antes del lanzamiento. */
export async function listWaitlistLeads(actor: PlatformActor, filtros: PaginationParams = {}) {
  return withTenant({ tenantId: null, bypassRls: true }, async (tx) => {
    const { page, pageSize, skip, take } = paginationArgs(filtros);
    const [items, total] = await Promise.all([
      tx.waitlistLead.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
      tx.waitlistLead.count(),
    ]);
    return toPaginatedResult(items, total, page, pageSize);
  });
}

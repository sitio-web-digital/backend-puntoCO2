import { PrismaClient } from "@prisma/client";
import { env } from "../env";

declare global {
  var __prisma: PrismaClient | undefined;
}

// Se conecta con `app_user` (RUNTIME_DATABASE_URL), no con el dueño de las tablas
// (DATABASE_URL, usado sólo por Prisma CLI para migrar), para que Row-Level
// Security se aplique: Postgres nunca aplica RLS a superusuarios ni al dueño
// de la tabla, así tenga FORCE ROW LEVEL SECURITY.
//
// Evita agotar conexiones en el hot-reload de `next dev`, que re-ejecuta módulos
// en cada cambio pero no reinicia el proceso de Node.
export const prisma = globalThis.__prisma ?? new PrismaClient({ datasourceUrl: env.RUNTIME_DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

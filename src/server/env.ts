import { z } from "zod";

const envSchema = z.object({
  // Usado por Prisma CLI (migraciones): rol dueño de las tablas, con privilegios de DDL.
  DATABASE_URL: z.string().url(),
  // Usado por la app y los tests en runtime: rol `app_user`, sin privilegios de superusuario,
  // para que las políticas de Row-Level Security se apliquen de verdad (ver
  // prisma/migrations/*_app_role_least_privilege).
  RUNTIME_DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET debe tener al menos 32 caracteres"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse(process.env);

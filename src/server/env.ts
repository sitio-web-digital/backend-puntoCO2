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
  // Credenciales de la cuenta Twilio de la PLATAFORMA (una sola, no por
  // tenant — ver src/server/notificaciones/twilio-sender.ts). Opcionales:
  // sin ellas el envío de WhatsApp falla limpio y cae al canal alternativo
  // (RF-19), no rompe el build ni el resto de la app.
  TWILIO_ACCOUNT_SID: z.string().trim().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().trim().min(1).optional(),
  // JSON opcional { "plantilla": "ContentSid de Twilio" } para las
  // plantillas de WhatsApp ya aprobadas por Meta. Sin entrada para una
  // plantilla dada, el sender manda texto libre (válido en el sandbox de
  // Twilio y dentro de la ventana de 24hs en producción).
  TWILIO_WHATSAPP_CONTENT_TEMPLATES: z.string().trim().min(1).optional(),
});

export const env = envSchema.parse(process.env);

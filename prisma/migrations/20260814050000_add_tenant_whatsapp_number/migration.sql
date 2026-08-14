-- Remitente de WhatsApp por tenant (Twilio, ver src/server/notificaciones/twilio-sender.ts).
-- No es un secreto: las credenciales de Twilio son de plataforma (env vars).
ALTER TABLE "tenants" ADD COLUMN "whatsappFromNumber" TEXT;

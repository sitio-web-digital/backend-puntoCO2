import type { CanalNotificacion } from "@prisma/client";

export interface EnvioNotificacion {
  destinatarioEmail: string | null;
  destinatarioWhatsapp: string | null;
  plantilla: string;
  payload: Record<string, unknown> | null;
}

export type ResultadoEnvio = { ok: true } | { ok: false; error: string };

export interface CanalSender {
  enviar(envio: EnvioNotificacion): Promise<ResultadoEnvio>;
}

/**
 * No hay credenciales de ningún proveedor real configuradas todavía (SMTP,
 * WhatsApp Business API, etc.) — CLAUDE.md prohíbe hardcodear secretos, así
 * que este sender es el que se usa mientras no existan esas variables de
 * entorno. Simula el resultado según si el dato de contacto necesario está
 * presente, que es exactamente lo que valida el criterio de aceptación
 * "contacto incompleto ⇒ se registra el error" — no hace falta un proveedor
 * real para que ese comportamiento sea correcto y testeable.
 *
 * Reemplazar por un sender real (ej. Resend/SendGrid para EMAIL, WhatsApp
 * Business API para WHATSAPP) es cuestión de implementar esta misma interfaz
 * leyendo las credenciales desde variables de entorno y registrar esa
 * implementación en `CANAL_SENDERS` — el resto del motor de notificaciones
 * (dedup, reintentos, fallback) no cambia.
 */
class LogCanalSender implements CanalSender {
  constructor(private readonly campo: "destinatarioEmail" | "destinatarioWhatsapp") {}

  async enviar(envio: EnvioNotificacion): Promise<ResultadoEnvio> {
    const destino = envio[this.campo];
    if (!destino) {
      return { ok: false, error: `Falta ${this.campo === "destinatarioEmail" ? "el email" : "el WhatsApp"} del destinatario` };
    }
    console.warn(`[notificaciones] (sender de log) enviaría "${envio.plantilla}" a ${destino}`);
    return { ok: true };
  }
}

const CANAL_SENDERS: Record<CanalNotificacion, CanalSender> = {
  EMAIL: new LogCanalSender("destinatarioEmail"),
  WHATSAPP: new LogCanalSender("destinatarioWhatsapp"),
  // TELEFONO es una preferencia de contacto de Cliente (RF-01), no un canal
  // de envío automatizado — RF-19 sólo pide "email, WhatsApp y canales
  // futuros configurables". Si se intenta usar, falla explícitamente en vez
  // de fingir que se envió.
  TELEFONO: {
    async enviar(): Promise<ResultadoEnvio> {
      return { ok: false, error: "TELEFONO no es un canal de envío automatizado soportado" };
    },
  },
};

export function getCanalSender(canal: CanalNotificacion): CanalSender {
  return CANAL_SENDERS[canal];
}

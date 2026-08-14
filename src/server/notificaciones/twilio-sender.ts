import twilio from "twilio";
import { env } from "../env";
import { prisma } from "../db/client";
import type { CanalSender, EnvioNotificacion, ResultadoEnvio } from "./channels";

let contentTemplates: Record<string, string> | null | undefined;

/** `{ "plantilla": "ContentSid" }` para las plantillas de WhatsApp ya
 * aprobadas por Meta (ver TWILIO_WHATSAPP_CONTENT_TEMPLATES en env.ts).
 * Se parsea una sola vez; si el JSON está mal formado, se ignora (no rompe
 * el envío, sólo hace que todo caiga al texto libre). */
function getContentTemplates(): Record<string, string> {
  if (contentTemplates !== undefined) return contentTemplates ?? {};
  if (!env.TWILIO_WHATSAPP_CONTENT_TEMPLATES) {
    contentTemplates = null;
    return {};
  }
  try {
    contentTemplates = JSON.parse(env.TWILIO_WHATSAPP_CONTENT_TEMPLATES) as Record<string, string>;
  } catch {
    console.error("[notificaciones] TWILIO_WHATSAPP_CONTENT_TEMPLATES no es JSON válido, se ignora");
    contentTemplates = null;
  }
  return contentTemplates ?? {};
}

function getTwilioClient() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return null;
  return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}

/** Acepta "+54 9 11 5555-1234" o similar (Cliente.whatsapp es texto libre,
 * sin formato forzado) y lo deja en E.164 (sólo dígitos y el "+" inicial).
 * Devuelve null si no queda nada usable. */
export function normalizarE164(numero: string): string | null {
  const limpio = numero.trim().replace(/[^\d+]/g, "");
  const conMas = limpio.startsWith("+") ? limpio : `+${limpio}`;
  return /^\+[1-9]\d{6,14}$/.test(conMas) ? conMas : null;
}

const MENSAJES_LIBRES: Record<string, (envio: EnvioNotificacion) => string> = {
  matafuego_vencido: (e) => {
    const codigo = (e.payload?.codigoInterno as string | undefined) ?? "tu unidad";
    return `Hola${e.destinatarioNombre ? ` ${e.destinatarioNombre}` : ""}, el matafuego ${codigo} está vencido. Contactanos para renovarlo.`;
  },
  vencimiento_proximo: (e) => {
    const codigo = (e.payload?.codigoInterno as string | undefined) ?? "tu unidad";
    return `Hola${e.destinatarioNombre ? ` ${e.destinatarioNombre}` : ""}, el matafuego ${codigo} está por vencer. Coordinemos la renovación.`;
  },
  prueba_hidraulica_proxima: (e) => {
    const codigo = (e.payload?.codigoInterno as string | undefined) ?? "tu unidad";
    return `Hola${e.destinatarioNombre ? ` ${e.destinatarioNombre}` : ""}, el matafuego ${codigo} tiene la prueba hidráulica próxima a vencer.`;
  },
  mantenimiento_proximo: (e) => {
    const servicio = (e.payload?.tipoServicio as string | undefined) ?? "un mantenimiento";
    return `Hola${e.destinatarioNombre ? ` ${e.destinatarioNombre}` : ""}, tenés ${servicio} programado próximamente.`;
  },
  mantenimiento_atrasado: (e) => {
    const servicio = (e.payload?.tipoServicio as string | undefined) ?? "un mantenimiento";
    return `Hola${e.destinatarioNombre ? ` ${e.destinatarioNombre}` : ""}, tenés ${servicio} atrasado. Coordinemos una fecha.`;
  },
};

function renderMensajeLibre(envio: EnvioNotificacion): string {
  const render = MENSAJES_LIBRES[envio.plantilla];
  if (render) return render(envio);
  return `Hola${envio.destinatarioNombre ? ` ${envio.destinatarioNombre}` : ""}, tenés una novedad en tu matafuego. Contactanos para más información.`;
}

/**
 * Envía WhatsApp vía Twilio (una sola cuenta de plataforma — Account SID +
 * Auth Token por variable de entorno — con un número remitente distinto
 * por tenant, `Tenant.whatsappFromNumber`). Si faltan credenciales de
 * plataforma o el tenant no tiene número configurado, falla limpio: el
 * motor de notificaciones ya sabe caer al canal alternativo (RF-19).
 *
 * Recordatorios de vencimiento son mensajes que la empresa inicia (el
 * cliente no escribió primero), así que en producción WhatsApp exige una
 * plantilla pre-aprobada por Meta (Content API, `contentSid`). Mientras no
 * exista esa plantilla para una `plantilla` dada (ver
 * TWILIO_WHATSAPP_CONTENT_TEMPLATES), se manda texto libre — válido en el
 * sandbox de Twilio para pruebas, y dentro de la ventana de 24hs si el
 * cliente ya escribió antes.
 */
export class TwilioWhatsAppSender implements CanalSender {
  async enviar(envio: EnvioNotificacion): Promise<ResultadoEnvio> {
    if (!envio.destinatarioWhatsapp) {
      return { ok: false, error: "Falta el WhatsApp del destinatario" };
    }
    const destino = normalizarE164(envio.destinatarioWhatsapp);
    if (!destino) {
      return { ok: false, error: `El WhatsApp del destinatario no es un número válido: "${envio.destinatarioWhatsapp}"` };
    }

    const client = getTwilioClient();
    if (!client) {
      return { ok: false, error: "Twilio no está configurado en este entorno (faltan TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN)" };
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: envio.tenantId }, select: { whatsappFromNumber: true } });
    if (!tenant?.whatsappFromNumber) {
      return { ok: false, error: "La empresa no tiene un número de WhatsApp configurado" };
    }

    const contentSid = getContentTemplates()[envio.plantilla];

    try {
      await client.messages.create(
        contentSid
          ? {
              from: `whatsapp:${tenant.whatsappFromNumber}`,
              to: `whatsapp:${destino}`,
              contentSid,
              contentVariables: JSON.stringify(envio.payload ?? {}),
            }
          : {
              from: `whatsapp:${tenant.whatsappFromNumber}`,
              to: `whatsapp:${destino}`,
              body: renderMensajeLibre(envio),
            },
      );
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error desconocido al enviar por Twilio" };
    }
  }
}

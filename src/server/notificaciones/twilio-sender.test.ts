import { describe, expect, it } from "vitest";
import { normalizarE164, TwilioWhatsAppSender } from "./twilio-sender";
import type { EnvioNotificacion } from "./channels";

function envioBase(overrides: Partial<EnvioNotificacion> = {}): EnvioNotificacion {
  return {
    tenantId: "tenant-inexistente",
    destinatarioNombre: "Juan Pérez",
    destinatarioEmail: null,
    destinatarioWhatsapp: "+5491155551234",
    plantilla: "vencimiento_proximo",
    payload: { codigoInterno: "MAT-0001" },
    ...overrides,
  };
}

describe("normalizarE164", () => {
  it("acepta un número ya en E.164", () => {
    expect(normalizarE164("+5491155551234")).toBe("+5491155551234");
  });

  it("saca espacios y guiones", () => {
    expect(normalizarE164("+54 9 11 5555-1234")).toBe("+5491155551234");
  });

  it("agrega el '+' si falta", () => {
    expect(normalizarE164("5491155551234")).toBe("+5491155551234");
  });

  it("rechaza texto que no es un número", () => {
    expect(normalizarE164("no es un telefono")).toBeNull();
  });

  it("rechaza un número demasiado corto", () => {
    expect(normalizarE164("+54911")).toBeNull();
  });
});

describe("TwilioWhatsAppSender", () => {
  // Esta suite no tiene credenciales reales de Twilio configuradas (ni
  // debería: son secretos de plataforma, nunca en el entorno de test) — así
  // que sólo puede verificar los caminos de falla limpia. El envío real
  // sólo se puede probar con una cuenta Twilio de verdad (ver el mensaje
  // final al usuario sobre qué necesita para probarlo).
  const sender = new TwilioWhatsAppSender();

  it("falla si falta el WhatsApp del destinatario", async () => {
    const resultado = await sender.enviar(envioBase({ destinatarioWhatsapp: null }));
    expect(resultado).toEqual({ ok: false, error: "Falta el WhatsApp del destinatario" });
  });

  it("falla si el WhatsApp del destinatario no es un número válido", async () => {
    const resultado = await sender.enviar(envioBase({ destinatarioWhatsapp: "no es un telefono" }));
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("no es un número válido");
  });

  it("falla limpio cuando Twilio no está configurado en este entorno (caso esperado en test/dev sin cuenta real)", async () => {
    const resultado = await sender.enviar(envioBase());
    expect(resultado).toEqual({
      ok: false,
      error: "Twilio no está configurado en este entorno (faltan TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN)",
    });
  });
});

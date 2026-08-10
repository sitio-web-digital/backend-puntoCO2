import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { anotarseWaitlist, listWaitlistLeads } from "./service";

const TELEFONO = "+54 9 11 5555-1234";

describe("lista de espera de la landing", () => {
  const createdEmails: string[] = [];

  afterEach(async () => {
    if (createdEmails.length > 0) {
      await prisma.waitlistLead.deleteMany({ where: { email: { in: createdEmails } } });
      createdEmails.length = 0;
    }
  });

  it("anota un email y teléfono nuevos", async () => {
    const email = `lead-${randomUUID().slice(0, 8)}@example.com`;
    createdEmails.push(email);

    await anotarseWaitlist({ email, telefono: TELEFONO });

    const lead = await prisma.waitlistLead.findUnique({ where: { email } });
    expect(lead).not.toBeNull();
    expect(lead?.telefono).toBe(TELEFONO);
  });

  it("normaliza el email a minúsculas", async () => {
    const email = `Lead-${randomUUID().slice(0, 8)}@Example.com`;
    createdEmails.push(email.toLowerCase());

    await anotarseWaitlist({ email, telefono: TELEFONO });

    const lead = await prisma.waitlistLead.findUnique({ where: { email: email.toLowerCase() } });
    expect(lead).not.toBeNull();
  });

  it("es idempotente: anotarse dos veces con el mismo email actualiza el teléfono en vez de duplicar", async () => {
    const email = `lead-${randomUUID().slice(0, 8)}@example.com`;
    createdEmails.push(email);

    await anotarseWaitlist({ email, telefono: TELEFONO });
    const otroTelefono = "+54 9 11 4444-7890";
    await expect(anotarseWaitlist({ email, telefono: otroTelefono })).resolves.not.toThrow();

    const count = await prisma.waitlistLead.count({ where: { email } });
    expect(count).toBe(1);
    const lead = await prisma.waitlistLead.findUnique({ where: { email } });
    expect(lead?.telefono).toBe(otroTelefono);
  });

  it("rechaza un email inválido", async () => {
    await expect(anotarseWaitlist({ email: "no-es-un-email", telefono: TELEFONO })).rejects.toThrow();
  });

  it("rechaza un teléfono vacío", async () => {
    const email = `lead-${randomUUID().slice(0, 8)}@example.com`;
    await expect(anotarseWaitlist({ email, telefono: "" })).rejects.toThrow();
  });

  it("rechaza un teléfono con letras", async () => {
    const email = `lead-${randomUUID().slice(0, 8)}@example.com`;
    await expect(anotarseWaitlist({ email, telefono: "no es un telefono" })).rejects.toThrow();
  });

  it("lista los leads de plataforma ordenados por fecha de alta descendente", async () => {
    const actor = { usuarioId: "test-superadmin" };
    const emailViejo = `lead-${randomUUID().slice(0, 8)}@example.com`;
    const emailNuevo = `lead-${randomUUID().slice(0, 8)}@example.com`;
    createdEmails.push(emailViejo, emailNuevo);

    await anotarseWaitlist({ email: emailViejo, telefono: TELEFONO });
    await anotarseWaitlist({ email: emailNuevo, telefono: TELEFONO });

    const { items, total } = await listWaitlistLeads(actor, { page: 1, pageSize: 50 });
    expect(total).toBeGreaterThanOrEqual(2);
    const emails = items.map((i) => i.email);
    expect(emails.indexOf(emailNuevo)).toBeLessThan(emails.indexOf(emailViejo));
  });
});

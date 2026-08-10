import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { anotarseWaitlist } from "./service";

describe("lista de espera de la landing", () => {
  const createdEmails: string[] = [];

  afterEach(async () => {
    if (createdEmails.length > 0) {
      await prisma.waitlistLead.deleteMany({ where: { email: { in: createdEmails } } });
      createdEmails.length = 0;
    }
  });

  it("anota un email nuevo", async () => {
    const email = `lead-${randomUUID().slice(0, 8)}@example.com`;
    createdEmails.push(email);

    await anotarseWaitlist({ email });

    const lead = await prisma.waitlistLead.findUnique({ where: { email } });
    expect(lead).not.toBeNull();
  });

  it("normaliza el email a minúsculas", async () => {
    const email = `Lead-${randomUUID().slice(0, 8)}@Example.com`;
    createdEmails.push(email.toLowerCase());

    await anotarseWaitlist({ email });

    const lead = await prisma.waitlistLead.findUnique({ where: { email: email.toLowerCase() } });
    expect(lead).not.toBeNull();
  });

  it("es idempotente: anotarse dos veces con el mismo email no falla", async () => {
    const email = `lead-${randomUUID().slice(0, 8)}@example.com`;
    createdEmails.push(email);

    await anotarseWaitlist({ email });
    await expect(anotarseWaitlist({ email })).resolves.not.toThrow();

    const count = await prisma.waitlistLead.count({ where: { email } });
    expect(count).toBe(1);
  });

  it("rechaza un email inválido", async () => {
    await expect(anotarseWaitlist({ email: "no-es-un-email" })).rejects.toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifica correctamente una contraseña con su hash", async () => {
    const hash = await hashPassword("Sup3r-Secreto!");
    await expect(verifyPassword(hash, "Sup3r-Secreto!")).resolves.toBe(true);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const hash = await hashPassword("Sup3r-Secreto!");
    await expect(verifyPassword(hash, "otra-cosa")).resolves.toBe(false);
  });

  it("nunca almacena la contraseña en texto plano dentro del hash", async () => {
    const hash = await hashPassword("Sup3r-Secreto!");
    expect(hash).not.toContain("Sup3r-Secreto!");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("no lanza excepción ante un hash corrupto o con formato inválido", async () => {
    await expect(verifyPassword("no-es-un-hash-valido", "cualquier-cosa")).resolves.toBe(false);
  });

  it("genera hashes distintos para la misma contraseña (salt aleatorio)", async () => {
    const [a, b] = await Promise.all([hashPassword("misma-clave"), hashPassword("misma-clave")]);
    expect(a).not.toBe(b);
  });
});

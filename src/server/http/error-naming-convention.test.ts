import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { matchErrorSuffix } from "./error-suffixes";

/**
 * handleApiError (error-response.ts) traduce errores de dominio a status HTTP
 * por convención de nombre de clase, para no acoplar esa capa genérica a cada
 * módulo de negocio. El problema: nada impedía que un módulo nuevo definiera
 * una clase de error con un nombre que no matchea ningún sufijo reconocido —
 * pasó cinco veces durante el desarrollo (ClienteNoEncontradoParaEstablecimientoError,
 * SectorPadreInvalidoError, RequiereReinspeccionError,
 * InspeccionNoRequiereNoConformidadError, QrNoEncontradoError), siempre
 * detectado tarde, en un smoke test manual contra el servidor real en vez de
 * en la suite de tests. Este test escanea el código fuente y lo atrapa antes.
 */

// Clases que a propósito NO se traducen (quedan como 500 genérico) o que
// manejan su propio status vía `instanceof` en handleApiError.
const ALLOWLIST = new Set(["UnauthorizedError", "ForbiddenError", "DefaultRoleMissingError"]);

function collectErrorClassNames(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      collectErrorClassNames(fullPath, acc);
      continue;
    }
    if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;

    const contents = readFileSync(fullPath, "utf-8");
    const matches = contents.matchAll(/this\.name\s*=\s*"([A-Za-z0-9_]+)"/g);
    for (const match of matches) {
      const name = match[1];
      if (name) acc.push(name);
    }
  }
  return acc;
}

describe("convención de nombres de errores de dominio", () => {
  it("toda clase de error definida en src/server termina en un sufijo que handleApiError reconoce, o está en el allowlist", () => {
    const srcServerDir = join(__dirname, "..");
    const nombres = collectErrorClassNames(srcServerDir);

    expect(nombres.length).toBeGreaterThan(0); // si esto da 0, el escaneo está roto, no que no hay errores

    const noReconocidos = nombres.filter((nombre) => !ALLOWLIST.has(nombre) && matchErrorSuffix(nombre) === null);

    expect(noReconocidos, `Clases sin sufijo reconocido (van a caer en 500 genérico): ${noReconocidos.join(", ")}`).toEqual([]);
  });
});

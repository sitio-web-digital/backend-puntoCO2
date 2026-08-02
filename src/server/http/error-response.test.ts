import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { handleApiError } from "./error-response";
import { UnauthorizedError } from "../auth/current-user";
import { ForbiddenError } from "../rbac/permissions";

/**
 * Este archivo fija el contrato de convención de nombres del que depende
 * handleApiError: cada módulo de negocio define sus propias clases de error
 * (ClienteNotFoundError, CuitDuplicadoError, SectorPadreInvalidoError...) sin
 * que este archivo genérico las conozca. Si el nombre no termina en uno de
 * los sufijos reconocidos, el error cae silenciosamente en 500 — como pasó
 * dos veces durante el desarrollo (detectado recién en un smoke test manual,
 * no en los tests unitarios de cada módulo). Este archivo es la red que
 * hace ese tipo de bug visible en la suite de tests.
 */
class EjemploNotFoundError extends Error {
  constructor() {
    super("no encontrado");
    this.name = "EjemploNotFoundError";
  }
}
class EjemploDuplicadoError extends Error {
  constructor() {
    super("duplicado");
    this.name = "EjemploDuplicadoError";
  }
}
class EjemploAlreadyExistsError extends Error {
  constructor() {
    super("ya existe");
    this.name = "EjemploAlreadyExistsError";
  }
}
class EjemploInvalidoError extends Error {
  constructor() {
    super("inválido");
    this.name = "EjemploInvalidoError";
  }
}
// Concordancia de género: "Ubicación inválidA", no "inválidO". Las dos formas
// tienen que reconocerse con el mismo patrón (ver error-suffixes.ts) — un bug
// real se escapó por mantener sufijos literales en vez de un regex único.
class EjemploInvalidaError extends Error {
  constructor() {
    super("inválida");
    this.name = "EjemploInvalidaError";
  }
}
class EjemploInvalidError extends Error {
  constructor() {
    super("invalid");
    this.name = "EjemploInvalidError";
  }
}
class ErrorSinConvencionReconocida extends Error {
  constructor() {
    super("no matchea ningún sufijo");
    this.name = "ErrorSinConvencionReconocida";
  }
}

async function statusOf(response: ReturnType<typeof handleApiError>): Promise<number> {
  return (await response).status;
}

describe("handleApiError: contrato de convención de nombres", () => {
  it("UnauthorizedError -> 401", async () => {
    expect(await statusOf(handleApiError(new UnauthorizedError()))).toBe(401);
  });

  it("ForbiddenError -> 403", async () => {
    expect(await statusOf(handleApiError(new ForbiddenError("CLIENTES", "VER")))).toBe(403);
  });

  it("ZodError -> 400", async () => {
    const zodError = new ZodError([]);
    expect(await statusOf(handleApiError(zodError))).toBe(400);
  });

  it("*NotFoundError -> 404", async () => {
    expect(await statusOf(handleApiError(new EjemploNotFoundError()))).toBe(404);
  });

  it("*DuplicadoError -> 409", async () => {
    expect(await statusOf(handleApiError(new EjemploDuplicadoError()))).toBe(409);
  });

  it("*AlreadyExistsError -> 409", async () => {
    expect(await statusOf(handleApiError(new EjemploAlreadyExistsError()))).toBe(409);
  });

  it("*InvalidoError -> 400", async () => {
    expect(await statusOf(handleApiError(new EjemploInvalidoError()))).toBe(400);
  });

  it("*InvalidaError -> 400 (concordancia de género femenino)", async () => {
    expect(await statusOf(handleApiError(new EjemploInvalidaError()))).toBe(400);
  });

  it("*InvalidError -> 400", async () => {
    expect(await statusOf(handleApiError(new EjemploInvalidError()))).toBe(400);
  });

  it("un error que no matchea ningún sufijo cae en 500 (no en 404 por accidente)", async () => {
    expect(await statusOf(handleApiError(new ErrorSinConvencionReconocida()))).toBe(500);
  });

  it("un valor que no es Error también cae en 500 sin romper", async () => {
    expect(await statusOf(handleApiError("no soy un Error"))).toBe(500);
  });
});

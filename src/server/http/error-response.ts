import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "../auth/current-user";
import { ForbiddenError } from "../rbac/permissions";
import { matchErrorSuffix } from "./error-suffixes";

/**
 * Traductor genérico de errores de dominio a respuestas HTTP, compartido por
 * todas las rutas de API. Los errores de "no encontrado" / "conflicto" /
 * "inválido" de cada módulo de negocio (ClienteNotFoundError,
 * CuitDuplicadoError, SectorPadreInvalidoError, etc.) se reconocen por
 * convención de nombre (ver error-suffixes.ts) en vez de importar cada clase
 * acá, para no acoplar esta capa genérica a cada módulo de negocio.
 */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: "unauthorized", message: err.message }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: "forbidden", message: err.message }, { status: 403 });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: "invalid_input", message: "Datos inválidos.", details: err.issues }, { status: 400 });
  }

  const name = err instanceof Error ? err.name : undefined;
  const message = err instanceof Error ? err.message : "Ocurrió un error inesperado.";
  const status = name ? matchErrorSuffix(name) : null;

  if (status === 404) {
    return NextResponse.json({ error: "not_found", message }, { status: 404 });
  }
  if (status === 409) {
    return NextResponse.json({ error: "conflict", message }, { status: 409 });
  }
  if (status === 400) {
    return NextResponse.json({ error: "invalid_input", message }, { status: 400 });
  }

  console.error(err);
  return NextResponse.json({ error: "internal_error", message: "Ocurrió un error inesperado." }, { status: 500 });
}

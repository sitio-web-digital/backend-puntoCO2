/**
 * Única fuente de verdad para la convención de nombres de errores de dominio.
 * handleApiError y el test que audita el código fuente importan esto mismo,
 * así nunca pueden desincronizarse entre sí (que es exactamente cómo se
 * escapó el bug de "InvalidoError" vs "InvalidaError": dos listas de sufijos
 * mantenidas a mano en dos archivos distintos).
 *
 * Usa regex en vez de sufijos literales por la concordancia de género del
 * español: "SectorInvalidoError" vs "UbicacionInvalidaError" son ambos
 * válidos y tienen que reconocerse con un solo patrón, no uno por género.
 */
export const ERROR_SUFFIX_PATTERNS: { status: 404 | 409 | 400; pattern: RegExp }[] = [
  { status: 404, pattern: /NotFoundError$/ },
  { status: 409, pattern: /(Duplicad[oa]|AlreadyExists)Error$/ },
  { status: 400, pattern: /Invalid[oa]?Error$/ },
];

export function matchErrorSuffix(name: string): 404 | 409 | 400 | null {
  for (const { status, pattern } of ERROR_SUFFIX_PATTERNS) {
    if (pattern.test(name)) return status;
  }
  return null;
}

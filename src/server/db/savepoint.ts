import type { TenantTx } from "./with-tenant";

let savepointCounter = 0;

/**
 * Ejecuta `fn` protegido por un SAVEPOINT de Postgres. Si `fn` lanza (por
 * ejemplo un P2002 por una carrera de unicidad), hace ROLLBACK TO SAVEPOINT
 * en vez de dejar que el error se propague tal cual: en Postgres, una sola
 * sentencia fallida dentro de una transacción deja el resto de la
 * transacción en estado "aborted" (25P02) hasta el próximo COMMIT/ROLLBACK,
 * aunque el error ya se haya capturado a nivel de aplicación — así que sin
 * SAVEPOINT, cualquier reintento dentro de la misma transacción interactiva
 * (ej. recalcular un número correlativo tras un choque) vuelve a fallar con
 * "current transaction is aborted", nunca llega a probar el segundo intento.
 */
export async function conSavepoint<T>(tx: TenantTx, fn: () => Promise<T>): Promise<T> {
  const nombre = `sp_${savepointCounter++}`;
  await tx.$executeRawUnsafe(`SAVEPOINT "${nombre}"`);
  try {
    const resultado = await fn();
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT "${nombre}"`);
    return resultado;
  } catch (err) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT "${nombre}"`);
    throw err;
  }
}

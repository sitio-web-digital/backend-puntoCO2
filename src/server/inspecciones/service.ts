import { Prisma, type EstadoMatafuego, type ResultadoInspeccion } from "@prisma/client";
import { withTenant } from "../db/with-tenant";
import { writeAudit } from "../audit/log";
import { getEffectivePermissions } from "../rbac/effective-permissions";
import { requirePermission } from "../rbac/permissions";
import type { TenantActor } from "../clientes/service";
import { createInspeccionSchema, type CreateInspeccionInput } from "./schemas";

const RECURSO = "INSPECCIONES" as const;

export class InspeccionNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró la inspección ${id}`);
    this.name = "InspeccionNotFoundError";
  }
}

export class MatafuegoAsociadoNotFoundError extends Error {
  constructor(matafuegoId: string) {
    super(`El matafuego ${matafuegoId} no existe o no pertenece a esta empresa`);
    this.name = "MatafuegoAsociadoNotFoundError";
  }
}

export class UbicacionDetectadaInvalidaError extends Error {
  constructor(ubicacionId: string) {
    super(`La ubicación detectada ${ubicacionId} no existe o no pertenece a esta empresa`);
    this.name = "UbicacionDetectadaInvalidaError";
  }
}

/**
 * Resultados que ameritan seguimiento (RF-06: "el sistema solicita la acción
 * posterior correspondiente"). APTO_CON_OBSERVACIONES entra acá porque, aunque
 * la unidad sigue en servicio, hay algo que registrar y resolver.
 *
 * Por ahora sólo se expone `requiereAccionSeguimiento` en la respuesta: la
 * generación automática de una no conformidad (RF-07), orden de trabajo
 * (RF-11) o notificación (RF-19) se conecta acá cuando esos módulos existan,
 * no antes — no tiene sentido escribir el enganche contra un modelo que
 * todavía no existe.
 */
const RESULTADOS_NO_CONFORMES = new Set<ResultadoInspeccion>([
  "APTO_CON_OBSERVACIONES",
  "REQUIERE_MANTENIMIENTO",
  "REQUIERE_RECARGA",
  "REQUIERE_REEMPLAZO",
  "NO_ENCONTRADO",
  "ACCESO_IMPOSIBLE",
]);

export function esResultadoNoConforme(resultado: ResultadoInspeccion): boolean {
  return RESULTADOS_NO_CONFORMES.has(resultado);
}

/** A qué estado pasa el matafuego según el resultado de la inspección.
 * ACCESO_IMPOSIBLE no está listado a propósito: si no se pudo llegar a la
 * unidad, no hay nada nuevo que decir de su estado real. */
const ESTADO_MATAFUEGO_POR_RESULTADO: Partial<Record<ResultadoInspeccion, EstadoMatafuego>> = {
  APTO: "APTO",
  APTO_CON_OBSERVACIONES: "OBSERVADO",
  REQUIERE_MANTENIMIENTO: "OBSERVADO",
  REQUIERE_RECARGA: "OBSERVADO",
  REQUIERE_REEMPLAZO: "OBSERVADO",
  NO_ENCONTRADO: "EXTRAVIADO",
};

export async function listInspecciones(actor: TenantActor, filtros: { matafuegoId?: string } = {}) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    if (scope === "TODAS") {
      return tx.inspeccion.findMany({
        ...(filtros.matafuegoId ? { where: { matafuegoId: filtros.matafuegoId } } : {}),
        orderBy: { fechaHora: "desc" },
      });
    }
    if (scope === "PROPIO") {
      return tx.inspeccion.findMany({
        where: { tecnicoId: actor.usuarioId, ...(filtros.matafuegoId ? { matafuegoId: filtros.matafuegoId } : {}) },
        orderBy: { fechaHora: "desc" },
      });
    }
    // ESTABLECIMIENTO_ASIGNADO/SUCURSAL_ACTUAL: mismo criterio que el resto de
    // los módulos hasta que exista el modelo de asignación técnico-establecimiento.
    return [];
  });
}

export async function getInspeccion(actor: TenantActor, inspeccionId: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const inspeccion = await tx.inspeccion.findUnique({ where: { id: inspeccionId } });
    if (!inspeccion) throw new InspeccionNotFoundError(inspeccionId);

    if (scope === "TODAS") return inspeccion;
    if (scope === "PROPIO" && inspeccion.tecnicoId === actor.usuarioId) return inspeccion;
    return null;
  });
}

/**
 * Registra una inspección y, como efecto directo sobre la unidad: actualiza
 * `fechaUltimaInspeccion` y deriva su nuevo `estado` a partir del resultado
 * (RF-04 y RF-06 quedan conectados por esto). Cualquier alcance no-PROHIBIDO
 * puede crear: la inspección siempre queda a nombre del actor autenticado, no
 * existe forma de registrar en nombre de otro técnico.
 */
export async function crearInspeccion(actor: TenantActor, rawInput: CreateInspeccionInput) {
  const input = createInspeccionSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    requirePermission(effective, RECURSO, "CREAR");

    const matafuego = await tx.matafuego.findUnique({ where: { id: input.matafuegoId } });
    if (!matafuego) throw new MatafuegoAsociadoNotFoundError(input.matafuegoId);

    if (input.ubicacionDetectadaId) {
      const ubicacion = await tx.ubicacion.findUnique({ where: { id: input.ubicacionDetectadaId }, select: { id: true } });
      if (!ubicacion) throw new UbicacionDetectadaInvalidaError(input.ubicacionDetectadaId);
    }

    const inspeccion = await tx.inspeccion.create({
      data: {
        tenantId: actor.tenantId,
        matafuegoId: matafuego.id,
        establecimientoId: matafuego.establecimientoId,
        tecnicoId: actor.usuarioId,
        ubicacionRegistradaId: matafuego.ubicacionId,
        ubicacionDetectadaId: input.ubicacionDetectadaId,
        resultado: input.resultado,
        comentarios: input.comentarios,
        firmaResponsableNombre: input.firmaResponsableNombre,
        latitud: input.latitud,
        longitud: input.longitud,
        dispositivo: input.dispositivo,
        estadoSincronizacion: input.estadoSincronizacion,
        equipoPresente: input.equipoPresente,
        accesoLibre: input.accesoLibre,
        senalizacionVisible: input.senalizacionVisible,
        soporteFirme: input.soporteFirme,
        ausenciaDanios: input.ausenciaDanios,
        ausenciaCorrosion: input.ausenciaCorrosion,
        mangueraEnBuenEstado: input.mangueraEnBuenEstado,
        boquillaSinObstrucciones: input.boquillaSinObstrucciones,
        precintoIntacto: input.precintoIntacto,
        pasadorSeguridadColocado: input.pasadorSeguridadColocado,
        manometroDentroDeRango: input.manometroDentroDeRango,
        pesoDentroDeTolerancia: input.pesoDentroDeTolerancia,
        etiquetaLegible: input.etiquetaLegible,
        fechaVigente: input.fechaVigente,
        sinIndiciosDeDescarga: input.sinIndiciosDeDescarga,
        ubicacionCorrecta: input.ubicacionCorrecta,
        fotografiaGeneral: input.fotografiaGeneral,
        fotografiaEtiqueta: input.fotografiaEtiqueta,
        fotografiaManometro: input.fotografiaManometro,
      } as Prisma.InspeccionUncheckedCreateInput,
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "CREATE",
      entidad: "Inspeccion",
      entidadId: inspeccion.id,
      valorNuevo: inspeccion,
    });

    const nuevoEstadoMatafuego = ESTADO_MATAFUEGO_POR_RESULTADO[input.resultado];
    await tx.matafuego.update({
      where: { id: matafuego.id },
      data: {
        fechaUltimaInspeccion: inspeccion.fechaHora,
        ...(nuevoEstadoMatafuego ? { estado: nuevoEstadoMatafuego } : {}),
      },
    });

    if (nuevoEstadoMatafuego && nuevoEstadoMatafuego !== matafuego.estado) {
      await writeAudit(tx, {
        tenantId: actor.tenantId,
        usuarioId: actor.usuarioId,
        accion: "STATUS_CHANGE",
        entidad: "Matafuego",
        entidadId: matafuego.id,
        valorAnterior: { estado: matafuego.estado },
        valorNuevo: { estado: nuevoEstadoMatafuego },
        motivo: `Resultado de inspección: ${input.resultado}`,
      });
    }

    return { ...inspeccion, requiereAccionSeguimiento: esResultadoNoConforme(input.resultado) };
  });
}

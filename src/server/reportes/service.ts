import { withTenant } from "../db/with-tenant";
import { getEffectivePermissions } from "../rbac/effective-permissions";
import { requirePermission, ForbiddenError } from "../rbac/permissions";
import type { TenantActor } from "../clientes/service";
import {
  filtrosListadoSchema,
  filtrosMantenimientosSchema,
  rangoFechasSchema,
  type FiltrosListadoInput,
  type FiltrosMantenimientosInput,
  type RangoFechasInput,
} from "./schemas";

const RECURSO = "REPORTES" as const;

/**
 * Ningún rol tiene hoy alcance ESTABLECIMIENTO_ASIGNADO/SUCURSAL_ACTUAL para
 * REPORTES (ver default-roles.ts) — sólo TODAS o PROHIBIDO. "Dado un usuario
 * limitado a una sucursal, sólo incluye datos autorizados" (RF-26) se cumple
 * por ahora negando el reporte completo a cualquier alcance que no sea
 * TODAS (fail closed), en vez de filtrar parcialmente sin ese scoping
 * todavía implementado.
 */
export async function requireReporteAccess(actor: TenantActor, accion: "VER" | "EXPORTAR") {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, accion);
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, accion);
  });
}

function rangoFecha(desde?: Date, hasta?: Date) {
  if (!desde && !hasta) return undefined;
  return { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) };
}

const DIAS_ANTICIPACION_POR_DEFECTO = 30;

export async function reporteUnidadesProximasAVencer(actor: TenantActor, diasAnticipacion = DIAS_ANTICIPACION_POR_DEFECTO) {
  await requireReporteAccess(actor, "VER");
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const ahora = new Date();
    const limite = new Date(ahora.getTime() + diasAnticipacion * 86_400_000);
    const datos = await tx.matafuego.findMany({
      where: {
        estado: { not: "VENCIDO" },
        OR: [
          { proximaInspeccion: { gte: ahora, lte: limite } },
          { proximaRecarga: { gte: ahora, lte: limite } },
          { proximaPruebaHidraulica: { gte: ahora, lte: limite } },
        ],
      },
      orderBy: { proximaInspeccion: "asc" },
    });
    return { filtros: { diasAnticipacion }, total: datos.length, datos };
  });
}

export async function reporteUnidadesVencidas(actor: TenantActor) {
  await requireReporteAccess(actor, "VER");
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const datos = await tx.matafuego.findMany({ where: { estado: "VENCIDO" }, orderBy: { codigoInterno: "asc" } });
    return { total: datos.length, datos };
  });
}

export async function reporteInspecciones(actor: TenantActor, rawFiltros: FiltrosListadoInput = {}) {
  await requireReporteAccess(actor, "VER");
  const filtros = filtrosListadoSchema.parse(rawFiltros);
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const fechaHora = rangoFecha(filtros.desde, filtros.hasta);
    const datos = await tx.inspeccion.findMany({
      where: {
        ...(fechaHora ? { fechaHora } : {}),
        ...(filtros.establecimientoId ? { establecimientoId: filtros.establecimientoId } : {}),
        ...(filtros.clienteId ? { matafuego: { clienteId: filtros.clienteId } } : {}),
      },
      orderBy: { fechaHora: "desc" },
    });
    return { filtros, total: datos.length, datos };
  });
}

export async function reporteMantenimientos(actor: TenantActor, rawFiltros: FiltrosMantenimientosInput = {}) {
  await requireReporteAccess(actor, "VER");
  const filtros = filtrosMantenimientosSchema.parse(rawFiltros);
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const fechaProgramada = rangoFecha(filtros.desde, filtros.hasta);
    const datos = await tx.mantenimientoProgramado.findMany({
      where: {
        ...(fechaProgramada ? { fechaProgramada } : {}),
        ...(filtros.establecimientoId ? { establecimientoId: filtros.establecimientoId } : {}),
        ...(filtros.estado ? { estado: filtros.estado } : {}),
        ...(filtros.tipoServicio ? { tipoServicio: filtros.tipoServicio } : {}),
      },
      orderBy: { fechaProgramada: "desc" },
    });
    return { filtros, total: datos.length, datos };
  });
}

export async function reporteOrdenesPorEstado(actor: TenantActor, rawFiltros: RangoFechasInput = {}) {
  await requireReporteAccess(actor, "VER");
  const filtros = rangoFechasSchema.parse(rawFiltros);
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const fechaApertura = rangoFecha(filtros.desde, filtros.hasta);
    const grupos = await tx.ordenTrabajo.groupBy({
      by: ["estado"],
      where: { ...(fechaApertura ? { fechaApertura } : {}) },
      _count: { _all: true },
    });
    const porEstado = grupos.map((g) => ({ estado: g.estado, cantidad: g._count._all }));
    return { filtros, total: porEstado.reduce((acc, g) => acc + g.cantidad, 0), porEstado };
  });
}

export async function reporteUnidadesRetiradas(actor: TenantActor, rawFiltros: RangoFechasInput = {}) {
  await requireReporteAccess(actor, "VER");
  const filtros = rangoFechasSchema.parse(rawFiltros);
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const fechaHoraRetiro = rangoFecha(filtros.desde, filtros.hasta);
    const datos = await tx.retiroEntrega.findMany({
      where: { ...(fechaHoraRetiro ? { fechaHoraRetiro } : {}) },
      orderBy: { fechaHoraRetiro: "desc" },
    });
    return { filtros, total: datos.length, datos };
  });
}

export async function reporteNoConformidades(actor: TenantActor, rawFiltros: RangoFechasInput = {}) {
  await requireReporteAccess(actor, "VER");
  const filtros = rangoFechasSchema.parse(rawFiltros);
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const createdAt = rangoFecha(filtros.desde, filtros.hasta);
    const datos = await tx.noConformidad.findMany({
      where: { ...(createdAt ? { createdAt } : {}) },
      orderBy: { createdAt: "desc" },
    });
    const porSeveridad = Object.entries(
      datos.reduce<Record<string, number>>((acc, nc) => {
        acc[nc.severidad] = (acc[nc.severidad] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([severidad, cantidad]) => ({ severidad, cantidad }));
    return { filtros, total: datos.length, porSeveridad, datos };
  });
}

export async function reporteCertificados(actor: TenantActor, rawFiltros: FiltrosListadoInput = {}) {
  await requireReporteAccess(actor, "VER");
  const filtros = filtrosListadoSchema.parse(rawFiltros);
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const fecha = rangoFecha(filtros.desde, filtros.hasta);
    const datos = await tx.certificado.findMany({
      where: {
        ...(fecha ? { fecha } : {}),
        ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
        ...(filtros.establecimientoId ? { establecimientoId: filtros.establecimientoId } : {}),
      },
      orderBy: { numero: "desc" },
    });
    return { filtros, total: datos.length, datos };
  });
}

export async function reporteNotificacionesFallidas(actor: TenantActor, rawFiltros: RangoFechasInput = {}) {
  await requireReporteAccess(actor, "VER");
  const filtros = rangoFechasSchema.parse(rawFiltros);
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const createdAt = rangoFecha(filtros.desde, filtros.hasta);
    const datos = await tx.notificacion.findMany({
      where: { estado: "FALLIDA", ...(createdAt ? { createdAt } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return { filtros, total: datos.length, datos };
  });
}

export async function reporteProductividadPorTecnico(actor: TenantActor, rawFiltros: RangoFechasInput = {}) {
  await requireReporteAccess(actor, "VER");
  const filtros = rangoFechasSchema.parse(rawFiltros);
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const fechaFinalizacion = rangoFecha(filtros.desde, filtros.hasta);
    const ordenes = await tx.ordenTrabajo.findMany({
      where: {
        estado: { in: ["FINALIZADA", "ENTREGADA", "FACTURADA"] },
        tecnicoAsignadoId: { not: null },
        ...(fechaFinalizacion ? { fechaFinalizacion } : {}),
      },
      select: { tecnicoAsignadoId: true, horasTrabajadas: true },
    });

    const porTecnico = new Map<string, { tecnicoAsignadoId: string; ordenesFinalizadas: number; horasTrabajadas: number }>();
    for (const orden of ordenes) {
      const id = orden.tecnicoAsignadoId!;
      const actual = porTecnico.get(id) ?? { tecnicoAsignadoId: id, ordenesFinalizadas: 0, horasTrabajadas: 0 };
      actual.ordenesFinalizadas += 1;
      actual.horasTrabajadas += orden.horasTrabajadas?.toNumber() ?? 0;
      porTecnico.set(id, actual);
    }

    const resultado = [...porTecnico.values()].sort((a, b) => b.ordenesFinalizadas - a.ordenesFinalizadas);
    return { filtros, total: resultado.length, porTecnico: resultado };
  });
}

/**
 * KPI de cobertura (RF-26), fórmula exacta del documento de requisitos:
 * (unidades inspeccionadas según frecuencia esperada / unidades que debían
 * inspeccionarse en el período) × 100.
 *
 * Simplificación deliberada: en vez de recorrer el motor completo de reglas
 * de mantenimiento por cada unidad (costoso y ya resuelto por otro módulo),
 * "debía inspeccionarse en el período" se aproxima con el campo
 * `Matafuego.proximaInspeccion` que ese motor ya mantiene actualizado
 * (vencida antes del fin del período, o cayendo dentro de él). "Inspeccionada
 * según lo esperado" es tener al menos una Inspeccion con fechaHora dentro
 * del período.
 */
export async function calcularCoberturaInspecciones(actor: TenantActor, rawFiltros: RangoFechasInput) {
  await requireReporteAccess(actor, "VER");
  const filtros = rangoFechasSchema.parse(rawFiltros);
  const hasta = filtros.hasta ?? new Date();
  const desde = filtros.desde ?? new Date(hasta.getTime() - 30 * 86_400_000);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const debianInspeccionarse = await tx.matafuego.findMany({
      where: { estado: { notIn: ["DADO_DE_BAJA", "EXTRAVIADO"] }, proximaInspeccion: { lte: hasta } },
      select: { id: true },
    });

    if (debianInspeccionarse.length === 0) {
      return { filtros: { desde, hasta }, unidadesQueDebianInspeccionarse: 0, unidadesInspeccionadas: 0, coberturaPorcentaje: null };
    }

    const ids = debianInspeccionarse.map((m) => m.id);
    const inspeccionadas = await tx.inspeccion.groupBy({
      by: ["matafuegoId"],
      where: { matafuegoId: { in: ids }, fechaHora: { gte: desde, lte: hasta } },
    });

    const coberturaPorcentaje = (inspeccionadas.length / debianInspeccionarse.length) * 100;
    return {
      filtros: { desde, hasta },
      unidadesQueDebianInspeccionarse: debianInspeccionarse.length,
      unidadesInspeccionadas: inspeccionadas.length,
      coberturaPorcentaje,
    };
  });
}

/** Indicadores adicionales (RF-26) computables con los módulos ya
 * implementados. Presupuestos aprobados, facturación por servicio/cliente,
 * consumo de repuestos y stock quedan afuera: dependen de RF-10, RF-16 y
 * RF-23/24, que todavía no existen — no hay datos reales que agregar. */
export async function calcularIndicadoresOperativos(actor: TenantActor, rawFiltros: RangoFechasInput = {}) {
  await requireReporteAccess(actor, "VER");
  const filtros = rangoFechasSchema.parse(rawFiltros);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const rango = rangoFecha(filtros.desde, filtros.hasta);

    const [equiposNoConformes, noConformidadesResueltas, ordenesFinalizadas, notificacionesFallidas] = await Promise.all([
      tx.noConformidad.count({ where: { ...(rango ? { createdAt: rango } : {}) } }),
      tx.noConformidad.findMany({
        where: { estado: "CERRADA", ...(rango ? { createdAt: rango } : {}) },
        select: { createdAt: true, updatedAt: true },
      }),
      tx.ordenTrabajo.findMany({
        where: {
          estado: { in: ["FINALIZADA", "ENTREGADA", "FACTURADA"] },
          fechaProgramada: { not: null },
          ...(rango ? { fechaFinalizacion: rango } : {}),
        },
        select: { fechaProgramada: true, fechaFinalizacion: true },
      }),
      tx.notificacion.count({ where: { estado: "FALLIDA", ...(rango ? { createdAt: rango } : {}) } }),
    ]);

    const tiempoMedioResolucionDias =
      noConformidadesResueltas.length === 0
        ? null
        : noConformidadesResueltas.reduce((acc, nc) => acc + (nc.updatedAt.getTime() - nc.createdAt.getTime()), 0) /
          noConformidadesResueltas.length /
          86_400_000;

    const ordenesEnTermino = ordenesFinalizadas.filter((o) => o.fechaFinalizacion! <= o.fechaProgramada!).length;
    const ordenesAtrasadas = ordenesFinalizadas.length - ordenesEnTermino;

    return {
      filtros,
      equiposNoConformes,
      tiempoMedioResolucionDias,
      ordenesEnTermino,
      ordenesAtrasadas,
      notificacionesFallidas,
    };
  });
}

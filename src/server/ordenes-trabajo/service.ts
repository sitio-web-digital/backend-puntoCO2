import { Prisma, type AlcancePermiso, type EstadoOrdenTrabajo } from "@prisma/client";
import type { TenantTx } from "../db/with-tenant";
import { withTenant } from "../db/with-tenant";
import { conSavepoint } from "../db/savepoint";
import { writeAudit } from "../audit/log";
import { getEffectivePermissions } from "../rbac/effective-permissions";
import { requirePermission, ForbiddenError } from "../rbac/permissions";
import { paginationArgs, toPaginatedResult, type PaginationParams } from "../db/pagination";
import type { TenantActor } from "../clientes/service";
import { getServicioSeleccionable } from "../servicios/service";
import { generarNotificacion } from "../notificaciones/service";
import {
  createOrdenTrabajoSchema,
  updateOrdenTrabajoSchema,
  crearOrdenDesdeOrigenSchema,
  registrarAvanceTecnicoSchema,
  asignarTecnicoSchema,
  agregarItemOrdenSchema,
  actualizarCantidadItemSchema,
  finalizarOrdenSchema,
  type CreateOrdenTrabajoInput,
  type UpdateOrdenTrabajoInput,
  type CrearOrdenDesdeOrigenInput,
  type RegistrarAvanceTecnicoInput,
  type AgregarItemOrdenInput,
  type ActualizarCantidadItemInput,
  type FinalizarOrdenInput,
} from "./schemas";

const RECURSO = "ORDENES_TRABAJO" as const;

export class OrdenTrabajoNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró la orden de trabajo ${id}`);
    this.name = "OrdenTrabajoNotFoundError";
  }
}

export class ClienteAsociadoNotFoundError extends Error {
  constructor(clienteId: string) {
    super(`El cliente ${clienteId} no existe o no pertenece a esta empresa`);
    this.name = "ClienteAsociadoNotFoundError";
  }
}

export class EstablecimientoAsociadoNotFoundError extends Error {
  constructor(establecimientoId: string) {
    super(`El establecimiento ${establecimientoId} no existe o no pertenece a esta empresa`);
    this.name = "EstablecimientoAsociadoNotFoundError";
  }
}

export class MatafuegoAsociadoNotFoundError extends Error {
  constructor(matafuegoId: string) {
    super(`El matafuego ${matafuegoId} no existe o no pertenece a esta empresa`);
    this.name = "MatafuegoAsociadoNotFoundError";
  }
}

export class TecnicoAsociadoInvalidoError extends Error {
  constructor(usuarioId: string) {
    super(`El usuario ${usuarioId} no existe o no pertenece a esta empresa`);
    this.name = "TecnicoAsociadoInvalidoError";
  }
}

export class InspeccionAsociadaInvalidaError extends Error {
  constructor(inspeccionId: string) {
    super(`La inspección ${inspeccionId} no existe o no pertenece a esta empresa`);
    this.name = "InspeccionAsociadaInvalidaError";
  }
}

export class NoConformidadAsociadaInvalidaError extends Error {
  constructor(noConformidadId: string) {
    super(`La no conformidad ${noConformidadId} no existe o no pertenece a esta empresa`);
    this.name = "NoConformidadAsociadaInvalidaError";
  }
}

export class MantenimientoAsociadoInvalidoError extends Error {
  constructor(mantenimientoId: string) {
    super(`El mantenimiento programado ${mantenimientoId} no existe o no pertenece a esta empresa`);
    this.name = "MantenimientoAsociadoInvalidoError";
  }
}

export class TransicionOrdenInvalidaError extends Error {
  constructor(desde: EstadoOrdenTrabajo, hacia: string) {
    super(`No se puede pasar de ${desde} a ${hacia}`);
    this.name = "TransicionOrdenInvalidaError";
  }
}

export class MotivoCancelacionRequeridoInvalidoError extends Error {
  constructor() {
    super("Cancelar una orden requiere indicar un motivo");
    this.name = "MotivoCancelacionRequeridoInvalidoError";
  }
}

export class DatosTecnicosIncompletosInvalidoError extends Error {
  constructor() {
    super("La orden no tiene ningún ítem de servicio registrado: no puede finalizarse sin datos técnicos");
    this.name = "DatosTecnicosIncompletosInvalidoError";
  }
}

export class EstadoOrdenNoPermiteEdicionInvalidoError extends Error {
  constructor(estado: EstadoOrdenTrabajo) {
    super(`La orden está en estado ${estado} y no admite modificar sus ítems o unidades`);
    this.name = "EstadoOrdenNoPermiteEdicionInvalidoError";
  }
}

const ESTADOS_EDITABLES: EstadoOrdenTrabajo[] = [
  "BORRADOR",
  "PENDIENTE_DE_APROBACION",
  "PROGRAMADA",
  "ASIGNADA",
  "EN_CAMINO",
  "EN_PROCESO",
  "PAUSADA",
];

const ESTADOS_CANCELABLES: EstadoOrdenTrabajo[] = [...ESTADOS_EDITABLES];

async function assertClientePerteneceAlTenant(tx: TenantTx, clienteId: string): Promise<void> {
  const cliente = await tx.cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
  if (!cliente) throw new ClienteAsociadoNotFoundError(clienteId);
}

async function assertEstablecimientoPerteneceAlTenant(tx: TenantTx, establecimientoId: string): Promise<void> {
  const establecimiento = await tx.establecimiento.findUnique({ where: { id: establecimientoId }, select: { id: true } });
  if (!establecimiento) throw new EstablecimientoAsociadoNotFoundError(establecimientoId);
}

async function getMatafuegoOAsociadoError(tx: TenantTx, matafuegoId: string) {
  const matafuego = await tx.matafuego.findUnique({ where: { id: matafuegoId } });
  if (!matafuego) throw new MatafuegoAsociadoNotFoundError(matafuegoId);
  return matafuego;
}

async function assertTecnicoPerteneceAlTenant(tx: TenantTx, usuarioId: string): Promise<void> {
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } });
  if (!usuario) throw new TecnicoAsociadoInvalidoError(usuarioId);
}

/** TODAS siempre puede. PROPIO sólo si la orden está asignada al actor —
 * coherente con el alcance PROPIO de VER/EDITAR de este recurso (RF-27). */
function puedeEditar(scope: AlcancePermiso, orden: { tecnicoAsignadoId: string | null }, actor: TenantActor): boolean {
  if (scope === "TODAS") return true;
  if (scope === "PROPIO") return orden.tecnicoAsignadoId === actor.usuarioId;
  return false;
}

async function siguienteNumero(tx: TenantTx): Promise<number> {
  const resultado = await tx.ordenTrabajo.aggregate({ _max: { numero: true } });
  return (resultado._max.numero ?? 0) + 1;
}

/** El correlativo se calcula dentro de la misma transacción del insert, pero
 * dos altas concurrentes igual podrían calcular el mismo número antes de que
 * la primera confirme: el índice único (tenantId, numero) es quien realmente
 * garantiza la unicidad, y acá sólo reintentamos si choca. El intento fallido
 * va envuelto en un SAVEPOINT (ver src/server/db/savepoint.ts): sin eso, el
 * P2002 deja el resto de la transacción "aborted" en Postgres y el reintento
 * fallaría igual, aunque el error ya esté capturado a nivel de aplicación. */
async function crearConNumeroCorrelativo(
  tx: TenantTx,
  data: Omit<Prisma.OrdenTrabajoUncheckedCreateInput, "numero">,
) {
  for (let intento = 0; intento < 5; intento++) {
    const numero = await siguienteNumero(tx);
    try {
      return await conSavepoint(tx, () => tx.ordenTrabajo.create({ data: { ...data, numero } }));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("No se pudo asignar un número de orden de trabajo tras varios intentos");
}

export async function listOrdenesTrabajo(
  actor: TenantActor,
  filtros: { estado?: EstadoOrdenTrabajo; clienteId?: string } = {},
) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const filtrosBase: Prisma.OrdenTrabajoWhereInput = {
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
    };

    if (scope === "TODAS") {
      return tx.ordenTrabajo.findMany({ where: filtrosBase, orderBy: { numero: "desc" }, include: { items: true, unidades: true } });
    }
    if (scope === "PROPIO") {
      return tx.ordenTrabajo.findMany({
        where: { ...filtrosBase, tecnicoAsignadoId: actor.usuarioId },
        orderBy: { numero: "desc" },
        include: { items: true, unidades: true },
      });
    }
    return [];
  });
}

export async function listOrdenesTrabajoPaginado(
  actor: TenantActor,
  filtros: { estado?: EstadoOrdenTrabajo; clienteId?: string } & PaginationParams = {},
) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const filtrosBase: Prisma.OrdenTrabajoWhereInput = {
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
    };

    if (scope !== "TODAS" && scope !== "PROPIO") {
      return toPaginatedResult([], 0, 1, paginationArgs(filtros).pageSize);
    }

    const where: Prisma.OrdenTrabajoWhereInput =
      scope === "PROPIO" ? { ...filtrosBase, tecnicoAsignadoId: actor.usuarioId } : filtrosBase;

    const { page, pageSize, skip, take } = paginationArgs(filtros);
    const [items, total] = await Promise.all([
      tx.ordenTrabajo.findMany({ where, orderBy: { numero: "desc" }, include: { items: true, unidades: true }, skip, take }),
      tx.ordenTrabajo.count({ where }),
    ]);
    return toPaginatedResult(items, total, page, pageSize);
  });
}

export async function getOrdenTrabajo(actor: TenantActor, id: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");

    const orden = await tx.ordenTrabajo.findUnique({ where: { id }, include: { items: true, unidades: true } });
    if (!orden) throw new OrdenTrabajoNotFoundError(id);

    if (scope === "TODAS") return orden;
    if (scope === "PROPIO" && orden.tecnicoAsignadoId === actor.usuarioId) return orden;
    return null;
  });
}

async function crearOrdenInterna(
  actor: TenantActor,
  tx: TenantTx,
  input: CreateOrdenTrabajoInput & { clienteId: string },
  origen: { tipo: typeof input.origen; inspeccionOrigenId?: string; noConformidadOrigenId?: string; mantenimientoOrigenId?: string },
) {
  await assertClientePerteneceAlTenant(tx, input.clienteId);
  if (input.establecimientoId) {
    await assertEstablecimientoPerteneceAlTenant(tx, input.establecimientoId);
  }
  if (input.tecnicoAsignadoId) {
    await assertTecnicoPerteneceAlTenant(tx, input.tecnicoAsignadoId);
  }

  const matafuegos = await Promise.all((input.matafuegoIds ?? []).map((id) => getMatafuegoOAsociadoError(tx, id)));

  const { matafuegoIds: _matafuegoIds, origen: _origen, ...rest } = input;
  void _matafuegoIds;
  void _origen;

  const orden = await crearConNumeroCorrelativo(tx, {
    tenantId: actor.tenantId,
    ...rest,
    origen: origen.tipo,
    ...(origen.inspeccionOrigenId ? { inspeccionOrigenId: origen.inspeccionOrigenId } : {}),
    ...(origen.noConformidadOrigenId ? { noConformidadOrigenId: origen.noConformidadOrigenId } : {}),
    ...(origen.mantenimientoOrigenId ? { mantenimientoOrigenId: origen.mantenimientoOrigenId } : {}),
  } as Omit<Prisma.OrdenTrabajoUncheckedCreateInput, "numero">);

  if (matafuegos.length > 0) {
    await tx.ordenTrabajoUnidad.createMany({
      data: matafuegos.map((m) => ({ tenantId: actor.tenantId, ordenId: orden.id, matafuegoId: m.id })),
    });
  }

  await writeAudit(tx, {
    tenantId: actor.tenantId,
    usuarioId: actor.usuarioId,
    accion: "CREATE",
    entidad: "OrdenTrabajo",
    entidadId: orden.id,
    valorNuevo: orden,
  });

  return tx.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id }, include: { items: true, unidades: true } });
}

export async function crearOrdenTrabajo(actor: TenantActor, rawInput: CreateOrdenTrabajoInput) {
  const input = createOrdenTrabajoSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "CREAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "CREAR");

    return crearOrdenInterna(actor, tx, input, { tipo: input.origen });
  });
}

/** Atajos para los orígenes de RF-11 que ya tienen módulo propio: copian
 * cliente/establecimiento/unidad desde el registro de origen en vez de
 * pedírselos de nuevo, y dejan vinculada la referencia (RF-11: "quedan
 * vinculadas la inspección y la unidad"). */
export async function crearOrdenDesdeInspeccion(actor: TenantActor, inspeccionId: string, rawDatos: CrearOrdenDesdeOrigenInput = {}) {
  const datos = crearOrdenDesdeOrigenSchema.parse(rawDatos);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "CREAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "CREAR");

    const inspeccion = await tx.inspeccion.findUnique({ where: { id: inspeccionId } });
    if (!inspeccion) throw new InspeccionAsociadaInvalidaError(inspeccionId);
    const matafuego = await tx.matafuego.findUniqueOrThrow({ where: { id: inspeccion.matafuegoId } });

    return crearOrdenInterna(
      actor,
      tx,
      { ...datos, clienteId: matafuego.clienteId, establecimientoId: inspeccion.establecimientoId, matafuegoIds: [matafuego.id] },
      { tipo: "INSPECCION", inspeccionOrigenId: inspeccion.id },
    );
  });
}

export async function crearOrdenDesdeNoConformidad(actor: TenantActor, noConformidadId: string, rawDatos: CrearOrdenDesdeOrigenInput = {}) {
  const datos = crearOrdenDesdeOrigenSchema.parse(rawDatos);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "CREAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "CREAR");

    const noConformidad = await tx.noConformidad.findUnique({ where: { id: noConformidadId } });
    if (!noConformidad) throw new NoConformidadAsociadaInvalidaError(noConformidadId);
    const matafuego = await tx.matafuego.findUniqueOrThrow({ where: { id: noConformidad.matafuegoId } });

    return crearOrdenInterna(
      actor,
      tx,
      { ...datos, clienteId: matafuego.clienteId, establecimientoId: matafuego.establecimientoId, matafuegoIds: [matafuego.id] },
      { tipo: "NO_CONFORMIDAD", noConformidadOrigenId: noConformidad.id },
    );
  });
}

export async function crearOrdenDesdeMantenimiento(actor: TenantActor, mantenimientoId: string, rawDatos: CrearOrdenDesdeOrigenInput = {}) {
  const datos = crearOrdenDesdeOrigenSchema.parse(rawDatos);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "CREAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "CREAR");

    const mantenimiento = await tx.mantenimientoProgramado.findUnique({ where: { id: mantenimientoId } });
    if (!mantenimiento) throw new MantenimientoAsociadoInvalidoError(mantenimientoId);
    const matafuego = await tx.matafuego.findUniqueOrThrow({ where: { id: mantenimiento.matafuegoId } });

    return crearOrdenInterna(
      actor,
      tx,
      {
        ...datos,
        clienteId: matafuego.clienteId,
        establecimientoId: mantenimiento.establecimientoId,
        matafuegoIds: [matafuego.id],
        ...(datos.tecnicoAsignadoId ? {} : mantenimiento.tecnicoAsignadoId ? { tecnicoAsignadoId: mantenimiento.tecnicoAsignadoId } : {}),
      },
      { tipo: "MANTENIMIENTO_PROGRAMADO", mantenimientoOrigenId: mantenimiento.id },
    );
  });
}

export async function updateOrdenTrabajo(actor: TenantActor, id: string, rawInput: UpdateOrdenTrabajoInput) {
  const input = updateOrdenTrabajoSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "EDITAR");

    const existing = await tx.ordenTrabajo.findUnique({ where: { id } });
    if (!existing) throw new OrdenTrabajoNotFoundError(id);
    if (!ESTADOS_EDITABLES.includes(existing.estado)) throw new EstadoOrdenNoPermiteEdicionInvalidoError(existing.estado);

    if (input.establecimientoId) {
      await assertEstablecimientoPerteneceAlTenant(tx, input.establecimientoId);
    }

    const actualizada = await tx.ordenTrabajo.update({ where: { id }, data: input as Prisma.OrdenTrabajoUncheckedUpdateInput });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "OrdenTrabajo",
      entidadId: id,
      valorAnterior: existing,
      valorNuevo: actualizada,
    });

    return actualizada;
  });
}

/** Registra avance operativo (horas, repuestos, resultado, observaciones) sin
 * cambiar de estado — el técnico asignado (PROPIO) puede ir completando estos
 * datos a medida que trabaja, en vez de tener que volcarlos todos recién al
 * finalizar. */
export async function registrarAvanceTecnico(actor: TenantActor, id: string, rawInput: RegistrarAvanceTecnicoInput) {
  const input = registrarAvanceTecnicoSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");

    const existing = await tx.ordenTrabajo.findUnique({ where: { id } });
    if (!existing) throw new OrdenTrabajoNotFoundError(id);
    if (!puedeEditar(scope, existing, actor)) throw new ForbiddenError(RECURSO, "EDITAR");
    if (!ESTADOS_EDITABLES.includes(existing.estado)) throw new EstadoOrdenNoPermiteEdicionInvalidoError(existing.estado);

    const actualizada = await tx.ordenTrabajo.update({ where: { id }, data: input as Prisma.OrdenTrabajoUncheckedUpdateInput });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "OrdenTrabajo",
      entidadId: id,
      valorAnterior: existing,
      valorNuevo: actualizada,
    });

    return actualizada;
  });
}

/** Coordinación (repartir trabajo) queda reservada a alcance TODAS, con el
 * mismo criterio que asignarResponsable en No conformidades: el
 * EDITAR:PROPIO que tiene el técnico le sirve para avanzar lo que ya es suyo,
 * no para asignarse o reasignarse órdenes. */
export async function asignarTecnico(actor: TenantActor, id: string, rawInput: { tecnicoAsignadoId: string }, motivo?: string) {
  const input = asignarTecnicoSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    if (scope !== "TODAS") throw new ForbiddenError(RECURSO, "EDITAR");

    const existing = await tx.ordenTrabajo.findUnique({ where: { id } });
    if (!existing) throw new OrdenTrabajoNotFoundError(id);
    if (!["PROGRAMADA", "ASIGNADA"].includes(existing.estado)) {
      throw new TransicionOrdenInvalidaError(existing.estado, "ASIGNADA");
    }

    await assertTecnicoPerteneceAlTenant(tx, input.tecnicoAsignadoId);

    const actualizada = await tx.ordenTrabajo.update({
      where: { id },
      data: { tecnicoAsignadoId: input.tecnicoAsignadoId, estado: "ASIGNADA" },
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "OrdenTrabajo",
      entidadId: id,
      valorAnterior: { tecnicoAsignadoId: existing.tecnicoAsignadoId, estado: existing.estado },
      valorNuevo: { tecnicoAsignadoId: actualizada.tecnicoAsignadoId, estado: actualizada.estado },
      motivo,
    });

    return actualizada;
  });
}

async function transicionar(
  actor: TenantActor,
  id: string,
  opciones: {
    accion?: "EDITAR" | "APROBAR";
    estadosOrigenValidos: EstadoOrdenTrabajo[];
    estadoDestino: EstadoOrdenTrabajo;
    requiereScopeTodas: boolean;
    dataExtra?: Record<string, unknown>;
    motivo?: string | undefined;
    validarAntes?: (orden: { estado: EstadoOrdenTrabajo }) => void;
  },
) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, opciones.accion ?? "EDITAR");

    const orden = await tx.ordenTrabajo.findUnique({ where: { id } });
    if (!orden) throw new OrdenTrabajoNotFoundError(id);

    const autorizado = opciones.requiereScopeTodas ? scope === "TODAS" : puedeEditar(scope, orden, actor);
    if (!autorizado) throw new ForbiddenError(RECURSO, opciones.accion ?? "EDITAR");

    if (!opciones.estadosOrigenValidos.includes(orden.estado)) {
      throw new TransicionOrdenInvalidaError(orden.estado, opciones.estadoDestino);
    }

    opciones.validarAntes?.(orden);

    const actualizada = await tx.ordenTrabajo.update({
      where: { id },
      data: { estado: opciones.estadoDestino, ...opciones.dataExtra },
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "OrdenTrabajo",
      entidadId: id,
      valorAnterior: { estado: orden.estado },
      valorNuevo: { estado: opciones.estadoDestino },
      motivo: opciones.motivo,
    });

    return actualizada;
  });
}

export function enviarAAprobacion(actor: TenantActor, id: string, motivo?: string) {
  return transicionar(actor, id, {
    estadosOrigenValidos: ["BORRADOR"],
    estadoDestino: "PENDIENTE_DE_APROBACION",
    requiereScopeTodas: true,
    motivo,
  });
}

/** Reservado a alcance TODAS a propósito: es un paso de control, coherente
 * con AccionPermiso.APROBAR (que sólo tienen roles de supervisión, no el
 * técnico de campo). */
export function aprobarOrden(actor: TenantActor, id: string, motivo?: string) {
  return transicionar(actor, id, {
    accion: "APROBAR",
    estadosOrigenValidos: ["BORRADOR", "PENDIENTE_DE_APROBACION"],
    estadoDestino: "PROGRAMADA",
    requiereScopeTodas: true,
    motivo,
  });
}

export function marcarEnCamino(actor: TenantActor, id: string) {
  return transicionar(actor, id, {
    estadosOrigenValidos: ["ASIGNADA"],
    estadoDestino: "EN_CAMINO",
    requiereScopeTodas: false,
  });
}

export function iniciarTrabajo(actor: TenantActor, id: string) {
  return transicionar(actor, id, {
    estadosOrigenValidos: ["ASIGNADA", "EN_CAMINO"],
    estadoDestino: "EN_PROCESO",
    requiereScopeTodas: false,
    dataExtra: { fechaInicio: new Date() },
  });
}

export function pausarOrden(actor: TenantActor, id: string, motivo?: string) {
  return transicionar(actor, id, {
    estadosOrigenValidos: ["EN_PROCESO"],
    estadoDestino: "PAUSADA",
    requiereScopeTodas: false,
    motivo,
  });
}

export function reanudarOrden(actor: TenantActor, id: string) {
  return transicionar(actor, id, {
    estadosOrigenValidos: ["PAUSADA"],
    estadoDestino: "EN_PROCESO",
    requiereScopeTodas: false,
  });
}

export async function finalizarOrden(actor: TenantActor, id: string, rawInput: FinalizarOrdenInput) {
  const input = finalizarOrdenSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");

    const orden = await tx.ordenTrabajo.findUnique({ where: { id }, include: { items: true } });
    if (!orden) throw new OrdenTrabajoNotFoundError(id);
    if (!puedeEditar(scope, orden, actor)) throw new ForbiddenError(RECURSO, "EDITAR");
    if (orden.estado !== "EN_PROCESO") throw new TransicionOrdenInvalidaError(orden.estado, "FINALIZADA");
    if (orden.items.length === 0) throw new DatosTecnicosIncompletosInvalidoError();

    const actualizada = await tx.ordenTrabajo.update({
      where: { id },
      data: {
        estado: "FINALIZADA",
        fechaFinalizacion: new Date(),
        resultadoTecnico: input.resultadoTecnico,
        ...(input.horasTrabajadas !== undefined ? { horasTrabajadas: input.horasTrabajadas } : {}),
      },
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "OrdenTrabajo",
      entidadId: id,
      valorAnterior: { estado: orden.estado },
      valorNuevo: { estado: "FINALIZADA" },
    });

    const cliente = await tx.cliente.findUnique({ where: { id: orden.clienteId } });
    if (cliente) {
      const canal = cliente.canalPreferido === "WHATSAPP" ? "WHATSAPP" : "EMAIL";
      await generarNotificacion(tx, {
        tenantId: actor.tenantId,
        evento: "UNIDAD_LISTA_PARA_ENTREGA",
        canal,
        canalAlternativo: canal === "EMAIL" ? "WHATSAPP" : "EMAIL",
        clienteId: cliente.id,
        destinatarioNombre: cliente.razonSocial ?? cliente.nombre,
        destinatarioEmail: cliente.email,
        destinatarioWhatsapp: cliente.whatsapp,
        entidadTipo: "OrdenTrabajo",
        entidadId: orden.id,
        plantilla: "unidad_lista_para_entrega",
        payload: { numeroOrden: orden.numero },
      });
    }

    return actualizada;
  });
}

/** El técnico que ejecutó el trabajo suele ser quien obtiene la conformidad
 * del cliente en el momento, así que esta transición también admite alcance
 * PROPIO (a diferencia de aprobar/facturar, que son pasos administrativos). */
export function entregarOrden(actor: TenantActor, id: string) {
  return transicionar(actor, id, {
    estadosOrigenValidos: ["FINALIZADA"],
    estadoDestino: "ENTREGADA",
    requiereScopeTodas: false,
    dataExtra: { confirmacionClienteRecibida: true },
  });
}

export function facturarOrden(actor: TenantActor, id: string) {
  return transicionar(actor, id, {
    estadosOrigenValidos: ["ENTREGADA"],
    estadoDestino: "FACTURADA",
    requiereScopeTodas: true,
  });
}

export async function cancelarOrden(actor: TenantActor, id: string, motivo: string) {
  if (!motivo || !motivo.trim()) throw new MotivoCancelacionRequeridoInvalidoError();
  return transicionar(actor, id, {
    estadosOrigenValidos: ESTADOS_CANCELABLES,
    estadoDestino: "CANCELADA",
    requiereScopeTodas: true,
    dataExtra: { motivoCancelacion: motivo },
    motivo,
  });
}

// ============================================================================
// Ítems de servicio y unidades de la orden
// ============================================================================

export async function agregarItemOrden(actor: TenantActor, ordenId: string, rawInput: AgregarItemOrdenInput) {
  const input = agregarItemOrdenSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");

    const orden = await tx.ordenTrabajo.findUnique({ where: { id: ordenId } });
    if (!orden) throw new OrdenTrabajoNotFoundError(ordenId);
    if (!puedeEditar(scope, orden, actor)) throw new ForbiddenError(RECURSO, "EDITAR");
    if (!ESTADOS_EDITABLES.includes(orden.estado)) throw new EstadoOrdenNoPermiteEdicionInvalidoError(orden.estado);

    if (input.matafuegoId) {
      await getMatafuegoOAsociadoError(tx, input.matafuegoId);
    }

    // getServicioSeleccionable abre su propia transacción (mismo patrón que
    // crearOrdenDesdeInspeccion con Inspeccion): no hay escritura previa que
    // perder atomicidad, sólo lectura, así que no hace falta duplicar esa
    // lógica acá.
    const servicio = await getServicioSeleccionable(actor, input.servicioId);
    const precioUnitario = servicio.precioBase.toNumber();
    const subtotal = precioUnitario * input.cantidad;

    const item = await tx.ordenTrabajoItem.create({
      data: {
        tenantId: actor.tenantId,
        ordenId,
        servicioId: servicio.id,
        ...(input.matafuegoId ? { matafuegoId: input.matafuegoId } : {}),
        descripcion: servicio.descripcion ?? servicio.nombre,
        cantidad: input.cantidad,
        precioUnitario,
        subtotal,
      },
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "CREATE",
      entidad: "OrdenTrabajoItem",
      entidadId: item.id,
      valorNuevo: item,
    });

    return item;
  });
}

/** Sólo cambia la cantidad (y recalcula el subtotal a partir del
 * precioUnitario ya fijado): cambiar de servicio implica quitar el ítem y
 * agregar uno nuevo, para no perder el snapshot de precio/descripción. */
export async function actualizarCantidadItemOrden(actor: TenantActor, ordenId: string, itemId: string, rawInput: ActualizarCantidadItemInput) {
  const input = actualizarCantidadItemSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");

    const orden = await tx.ordenTrabajo.findUnique({ where: { id: ordenId } });
    if (!orden) throw new OrdenTrabajoNotFoundError(ordenId);
    if (!puedeEditar(scope, orden, actor)) throw new ForbiddenError(RECURSO, "EDITAR");
    if (!ESTADOS_EDITABLES.includes(orden.estado)) throw new EstadoOrdenNoPermiteEdicionInvalidoError(orden.estado);

    const item = await tx.ordenTrabajoItem.findFirst({ where: { id: itemId, ordenId } });
    if (!item) return null;

    const subtotal = item.precioUnitario.toNumber() * input.cantidad;
    const actualizado = await tx.ordenTrabajoItem.update({ where: { id: itemId }, data: { cantidad: input.cantidad, subtotal } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "OrdenTrabajoItem",
      entidadId: itemId,
      valorAnterior: { cantidad: item.cantidad, subtotal: item.subtotal.toString() },
      valorNuevo: { cantidad: actualizado.cantidad, subtotal: actualizado.subtotal.toString() },
    });

    return actualizado;
  });
}

export async function quitarItemOrden(actor: TenantActor, ordenId: string, itemId: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");

    const orden = await tx.ordenTrabajo.findUnique({ where: { id: ordenId } });
    if (!orden) throw new OrdenTrabajoNotFoundError(ordenId);
    if (!puedeEditar(scope, orden, actor)) throw new ForbiddenError(RECURSO, "EDITAR");
    if (!ESTADOS_EDITABLES.includes(orden.estado)) throw new EstadoOrdenNoPermiteEdicionInvalidoError(orden.estado);

    const item = await tx.ordenTrabajoItem.findFirst({ where: { id: itemId, ordenId } });
    if (!item) return null;

    await tx.ordenTrabajoItem.delete({ where: { id: itemId } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "DELETE",
      entidad: "OrdenTrabajoItem",
      entidadId: itemId,
      valorAnterior: item,
    });

    return item;
  });
}

/** No se persiste un total en la orden por el mismo motivo que el margen de
 * Servicio (RF-09): evitar que quede desincronizado de los ítems reales. */
export function calcularTotalOrden(items: { subtotal: Prisma.Decimal }[]): number {
  return items.reduce((acc, item) => acc + item.subtotal.toNumber(), 0);
}

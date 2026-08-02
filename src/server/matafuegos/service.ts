import { Prisma, type EstadoMatafuego } from "@prisma/client";
import type { TenantTx } from "../db/with-tenant";
import { withTenant } from "../db/with-tenant";
import { writeAudit } from "../audit/log";
import { getEffectivePermissions } from "../rbac/effective-permissions";
import { requirePermission, ForbiddenError } from "../rbac/permissions";
import type { TenantActor } from "../clientes/service";
import { generateQrToken } from "../qr/token";
import {
  createMatafuegoSchema,
  updateMatafuegoSchema,
  moverMatafuegoSchema,
  CAMPOS_OPERATIVOS_MATAFUEGO,
  type CreateMatafuegoInput,
  type UpdateMatafuegoInput,
  type MoverMatafuegoInput,
} from "./schemas";

const RECURSO = "MATAFUEGOS" as const;
const CAMPOS_OPERATIVOS = new Set<string>(CAMPOS_OPERATIVOS_MATAFUEGO);

export class MatafuegoNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el matafuego ${id}`);
    this.name = "MatafuegoNotFoundError";
  }
}

export class NumeroSerieDuplicadoError extends Error {
  constructor(numeroSerie: string) {
    super(`Ya existe un matafuego con número de serie ${numeroSerie} en esta empresa`);
    this.name = "NumeroSerieDuplicadoError";
  }
}

export class CodigoInternoDuplicadoError extends Error {
  constructor(codigoInterno: string) {
    super(`Ya existe un matafuego con código interno ${codigoInterno} en esta empresa`);
    this.name = "CodigoInternoDuplicadoError";
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

export class SectorInvalidoError extends Error {
  constructor(sectorId: string) {
    super(`El sector ${sectorId} no existe o no pertenece al establecimiento indicado`);
    this.name = "SectorInvalidoError";
  }
}

export class UbicacionInvalidaError extends Error {
  constructor(ubicacionId: string) {
    super(`La ubicación ${ubicacionId} no existe o no pertenece al sector indicado`);
    this.name = "UbicacionInvalidaError";
  }
}

async function assertClientePerteneceAlTenant(tx: TenantTx, clienteId: string): Promise<void> {
  const cliente = await tx.cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
  if (!cliente) throw new ClienteAsociadoNotFoundError(clienteId);
}

async function assertEstablecimientoPerteneceAlTenant(tx: TenantTx, establecimientoId: string): Promise<void> {
  const establecimiento = await tx.establecimiento.findUnique({ where: { id: establecimientoId }, select: { id: true } });
  if (!establecimiento) throw new EstablecimientoAsociadoNotFoundError(establecimientoId);
}

async function assertSectorValido(tx: TenantTx, establecimientoId: string, sectorId: string): Promise<void> {
  const sector = await tx.sector.findUnique({ where: { id: sectorId }, select: { establecimientoId: true } });
  if (!sector || sector.establecimientoId !== establecimientoId) {
    throw new SectorInvalidoError(sectorId);
  }
}

async function assertUbicacionValida(tx: TenantTx, sectorId: string, ubicacionId: string): Promise<void> {
  const ubicacion = await tx.ubicacion.findUnique({ where: { id: ubicacionId }, select: { sectorId: true } });
  if (!ubicacion || ubicacion.sectorId !== sectorId) {
    throw new UbicacionInvalidaError(ubicacionId);
  }
}

/** Chequeo previo explícito en vez de parsear `err.meta.target` del P2002:
 * con índices únicos compuestos (`@@unique([tenantId, numeroSerie])`) el
 * driver de Postgres no siempre puebla `target` con los nombres de columna
 * (llega `null`), así que confiar en eso da mensajes genéricos o directamente
 * deja pasar el PrismaClientKnownRequestError crudo. El constraint de la DB
 * sigue ahí como defensa de última instancia ante una carrera entre este
 * chequeo y el insert. */
async function assertNumeroSerieYCodigoInternoDisponibles(tx: TenantTx, numeroSerie: string, codigoInterno: string): Promise<void> {
  const [porNumeroSerie, porCodigoInterno] = await Promise.all([
    tx.matafuego.findFirst({ where: { numeroSerie }, select: { id: true } }),
    tx.matafuego.findFirst({ where: { codigoInterno }, select: { id: true } }),
  ]);
  if (porNumeroSerie) throw new NumeroSerieDuplicadoError(numeroSerie);
  if (porCodigoInterno) throw new CodigoInternoDuplicadoError(codigoInterno);
}

export async function listMatafuegos(
  actor: TenantActor,
  filtros: { estado?: EstadoMatafuego; clienteId?: string; establecimientoId?: string } = {},
) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") return [];

    return tx.matafuego.findMany({
      where: {
        ...(filtros.estado ? { estado: filtros.estado } : {}),
        ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
        ...(filtros.establecimientoId ? { establecimientoId: filtros.establecimientoId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function getMatafuego(actor: TenantActor, matafuegoId: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") return null;

    const matafuego = await tx.matafuego.findUnique({ where: { id: matafuegoId } });
    if (!matafuego) throw new MatafuegoNotFoundError(matafuegoId);
    return matafuego;
  });
}

export async function createMatafuego(actor: TenantActor, rawInput: CreateMatafuegoInput) {
  const input = createMatafuegoSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    requirePermission(effective, RECURSO, "CREAR");

    await assertClientePerteneceAlTenant(tx, input.clienteId);
    await assertEstablecimientoPerteneceAlTenant(tx, input.establecimientoId);
    if (input.sectorId) {
      await assertSectorValido(tx, input.establecimientoId, input.sectorId);
    }
    if (input.ubicacionId) {
      if (!input.sectorId) throw new UbicacionInvalidaError(input.ubicacionId);
      await assertUbicacionValida(tx, input.sectorId, input.ubicacionId);
    }
    await assertNumeroSerieYCodigoInternoDisponibles(tx, input.numeroSerie, input.codigoInterno);

    const matafuego = await tx.matafuego.create({
      data: { tenantId: actor.tenantId, qrToken: generateQrToken(), ...input } as Prisma.MatafuegoUncheckedCreateInput,
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "CREATE",
      entidad: "Matafuego",
      entidadId: matafuego.id,
      valorNuevo: matafuego,
    });

    return matafuego;
  });
}

export async function updateMatafuego(actor: TenantActor, matafuegoId: string, rawInput: UpdateMatafuegoInput) {
  const input = updateMatafuegoSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");

    if (scope !== "TODAS") {
      // Alcance no administrativo (p. ej. Técnico de campo): sólo puede tocar
      // los campos de relevamiento físico, nunca datos administrativos como
      // código interno, tipo de agente, fabricante, etc.
      const camposNoPermitidos = Object.keys(input).filter((campo) => !CAMPOS_OPERATIVOS.has(campo));
      if (camposNoPermitidos.length > 0) {
        throw new ForbiddenError(RECURSO, "EDITAR");
      }
    }

    const existing = await tx.matafuego.findUnique({ where: { id: matafuegoId } });
    if (!existing) throw new MatafuegoNotFoundError(matafuegoId);

    if (input.numeroSerie && input.numeroSerie !== existing.numeroSerie) {
      const conflicto = await tx.matafuego.findFirst({ where: { numeroSerie: input.numeroSerie, id: { not: matafuegoId } }, select: { id: true } });
      if (conflicto) throw new NumeroSerieDuplicadoError(input.numeroSerie);
    }
    if (input.codigoInterno && input.codigoInterno !== existing.codigoInterno) {
      const conflicto = await tx.matafuego.findFirst({ where: { codigoInterno: input.codigoInterno, id: { not: matafuegoId } }, select: { id: true } });
      if (conflicto) throw new CodigoInternoDuplicadoError(input.codigoInterno);
    }

    const actualizado = await tx.matafuego.update({ where: { id: matafuegoId }, data: input as Prisma.MatafuegoUncheckedUpdateInput });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "Matafuego",
      entidadId: matafuegoId,
      valorAnterior: existing,
      valorNuevo: actualizado,
    });

    return actualizado;
  });
}

export async function cambiarEstadoMatafuego(actor: TenantActor, matafuegoId: string, nuevoEstado: EstadoMatafuego, motivo?: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    if (scope !== "TODAS") {
      throw new ForbiddenError(RECURSO, "EDITAR");
    }

    const existing = await tx.matafuego.findUnique({ where: { id: matafuegoId } });
    if (!existing) throw new MatafuegoNotFoundError(matafuegoId);

    const actualizado = await tx.matafuego.update({ where: { id: matafuegoId }, data: { estado: nuevoEstado } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "STATUS_CHANGE",
      entidad: "Matafuego",
      entidadId: matafuegoId,
      valorAnterior: { estado: existing.estado },
      valorNuevo: { estado: nuevoEstado },
      motivo,
    });

    return actualizado;
  });
}

export function darDeBajaMatafuego(actor: TenantActor, matafuegoId: string, motivo?: string) {
  return cambiarEstadoMatafuego(actor, matafuegoId, "DADO_DE_BAJA", motivo);
}

/** Traslada un matafuego a otro sector/ubicación dentro del mismo
 * establecimiento, dejando registro en movimientos_matafuego (RF-03: "cuando
 * cambia de ubicación, se registra origen, destino, fecha y usuario"). */
export async function moverMatafuego(actor: TenantActor, matafuegoId: string, rawInput: MoverMatafuegoInput) {
  const input = moverMatafuegoSchema.parse(rawInput);

  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "EDITAR");
    if (scope !== "TODAS") {
      throw new ForbiddenError(RECURSO, "EDITAR");
    }

    const existing = await tx.matafuego.findUnique({ where: { id: matafuegoId } });
    if (!existing) throw new MatafuegoNotFoundError(matafuegoId);

    if (input.sectorDestinoId) {
      await assertSectorValido(tx, existing.establecimientoId, input.sectorDestinoId);
    }
    if (input.ubicacionDestinoId) {
      const sectorDestino = input.sectorDestinoId ?? existing.sectorId;
      if (!sectorDestino) throw new UbicacionInvalidaError(input.ubicacionDestinoId);
      await assertUbicacionValida(tx, sectorDestino, input.ubicacionDestinoId);
    }

    // Ya estamos dentro de la transacción abierta por withTenant: no hace
    // falta (ni Prisma permite) anidar otra con $transaction acá.
    const actualizado = await tx.matafuego.update({
      where: { id: matafuegoId },
      data: {
        sectorId: input.sectorDestinoId ?? existing.sectorId,
        ubicacionId: input.ubicacionDestinoId ?? existing.ubicacionId,
      },
    });
    await tx.movimientoMatafuego.create({
      data: {
        tenantId: actor.tenantId,
        matafuegoId,
        sectorOrigenId: existing.sectorId,
        ubicacionOrigenId: existing.ubicacionId,
        sectorDestinoId: input.sectorDestinoId ?? existing.sectorId,
        ubicacionDestinoId: input.ubicacionDestinoId ?? existing.ubicacionId,
        usuarioId: actor.usuarioId,
        motivo: input.motivo ?? null,
      },
    });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "Matafuego",
      entidadId: matafuegoId,
      valorAnterior: { sectorId: existing.sectorId, ubicacionId: existing.ubicacionId },
      valorNuevo: { sectorId: actualizado.sectorId, ubicacionId: actualizado.ubicacionId },
      motivo: input.motivo,
    });

    return actualizado;
  });
}

export async function listMovimientosDeMatafuego(actor: TenantActor, matafuegoId: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, RECURSO, "VER");
    if (scope !== "TODAS") return [];

    return tx.movimientoMatafuego.findMany({ where: { matafuegoId }, orderBy: { createdAt: "desc" } });
  });
}

import type { AgenteExtintor, EstadoMatafuego, TipoMatafuego } from "@prisma/client";
import { withTenant } from "../db/with-tenant";
import { writeAudit } from "../audit/log";
import { getEffectivePermissions } from "../rbac/effective-permissions";
import { requirePermission, ForbiddenError } from "../rbac/permissions";
import type { TenantActor } from "../clientes/service";
import { MatafuegoNotFoundError } from "../matafuegos/service";
import { generateQrToken } from "./token";

export class QrNotFoundError extends Error {
  constructor() {
    super("Código QR no válido o no reconocido");
    this.name = "QrNotFoundError";
  }
}

/**
 * Vista pública de un matafuego por su QR (RF-05): deliberadamente sólo
 * expone lo necesario para "consultar vigencia" y "consultar estado" sin
 * autenticarse. Nunca incluye cliente, establecimiento, ubicación exacta,
 * ni ningún dato fiscal/comercial — eso queda detrás del login normal
 * (GET /api/matafuegos/{matafuegoId}, con RBAC).
 */
export interface QrPublicView {
  matafuegoId: string;
  tipo: TipoMatafuego;
  agenteExtintor: AgenteExtintor;
  capacidadNominal: string | null;
  estado: EstadoMatafuego;
  proximaInspeccion: Date | null;
  proximoMantenimiento: Date | null;
  proximaRecarga: Date | null;
  proximaPruebaHidraulica: Date | null;
}

export async function resolveQrPublico(token: string): Promise<QrPublicView> {
  const matafuego = await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
    tx.matafuego.findUnique({
      where: { qrToken: token },
      select: {
        id: true,
        tipo: true,
        agenteExtintor: true,
        capacidadNominal: true,
        estado: true,
        proximaInspeccion: true,
        proximoMantenimiento: true,
        proximaRecarga: true,
        proximaPruebaHidraulica: true,
      },
    }),
  );

  if (!matafuego) throw new QrNotFoundError();

  return {
    matafuegoId: matafuego.id,
    tipo: matafuego.tipo,
    agenteExtintor: matafuego.agenteExtintor,
    capacidadNominal: matafuego.capacidadNominal,
    estado: matafuego.estado,
    proximaInspeccion: matafuego.proximaInspeccion,
    proximoMantenimiento: matafuego.proximoMantenimiento,
    proximaRecarga: matafuego.proximaRecarga,
    proximaPruebaHidraulica: matafuego.proximaPruebaHidraulica,
  };
}

/**
 * Sólo para decidir server-side si mostrar el link "Ir a la ficha completa"
 * en la página pública del QR: nunca se expone al público, a diferencia de
 * `resolveQrPublico`. Deliberadamente no reusa esa función porque acá sí
 * necesitamos `tenantId`, que `QrPublicView` omite a propósito.
 */
export async function resolveMatafuegoIdYTenant(token: string): Promise<{ matafuegoId: string; tenantId: string } | null> {
  const matafuego = await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
    tx.matafuego.findUnique({ where: { qrToken: token }, select: { id: true, tenantId: true } }),
  );
  if (!matafuego) return null;
  return { matafuegoId: matafuego.id, tenantId: matafuego.tenantId };
}

/** Emite un QR nuevo e invalida el anterior (sticker perdido/dañado). Requiere
 * alcance administrativo: es una operación sensible — cualquiera con el QR
 * viejo pierde acceso a la ficha pública apenas se regenera. */
export async function regenerarQrMatafuego(actor: TenantActor, matafuegoId: string, motivo?: string) {
  return withTenant({ tenantId: actor.tenantId }, async (tx) => {
    const effective = await getEffectivePermissions(tx, actor.usuarioId);
    const scope = requirePermission(effective, "MATAFUEGOS", "EDITAR");
    if (scope !== "TODAS") {
      throw new ForbiddenError("MATAFUEGOS", "EDITAR");
    }

    const existing = await tx.matafuego.findUnique({ where: { id: matafuegoId } });
    if (!existing) throw new MatafuegoNotFoundError(matafuegoId);

    const nuevoToken = generateQrToken();
    const actualizado = await tx.matafuego.update({ where: { id: matafuegoId }, data: { qrToken: nuevoToken } });

    await writeAudit(tx, {
      tenantId: actor.tenantId,
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      entidad: "Matafuego",
      entidadId: matafuegoId,
      valorAnterior: { qrToken: existing.qrToken },
      valorNuevo: { qrToken: nuevoToken },
      motivo,
    });

    return actualizado;
  });
}

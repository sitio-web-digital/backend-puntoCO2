import { z } from "zod";

export const rangoFechasSchema = z.object({
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});
export type RangoFechasInput = z.input<typeof rangoFechasSchema>;

export const filtrosListadoSchema = rangoFechasSchema.extend({
  clienteId: z.string().min(1).optional(),
  establecimientoId: z.string().min(1).optional(),
});
export type FiltrosListadoInput = z.input<typeof filtrosListadoSchema>;

const ESTADO_MANTENIMIENTO = ["PROGRAMADO", "REPROGRAMADO", "REALIZADO", "CANCELADO"] as const;
const TIPO_SERVICIO_MANTENIMIENTO = [
  "INSPECCION",
  "MANTENIMIENTO",
  "RECARGA",
  "PRUEBA_HIDRAULICA",
  "CAMBIO_AGENTE",
  "REPARACION",
  "RETIRO_ENTREGA",
  "OTRO",
] as const;

export const filtrosMantenimientosSchema = filtrosListadoSchema.extend({
  estado: z.enum(ESTADO_MANTENIMIENTO).optional(),
  tipoServicio: z.enum(TIPO_SERVICIO_MANTENIMIENTO).optional(),
});
export type FiltrosMantenimientosInput = z.input<typeof filtrosMantenimientosSchema>;

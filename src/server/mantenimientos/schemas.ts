import { z } from "zod";

const TIPO_SERVICIO = ["INSPECCION", "MANTENIMIENTO", "RECARGA", "PRUEBA_HIDRAULICA", "CAMBIO_AGENTE", "REPARACION", "RETIRO_ENTREGA", "OTRO"] as const;
const TIPO_MATAFUEGO = ["PORTATIL", "RODANTE", "VEHICULAR", "OTRO"] as const;
const AGENTE_EXTINTOR = ["POLVO_QUIMICO_ABC", "CO2", "AGUA", "ESPUMA", "AGENTE_LIMPIO", "OTRO"] as const;

export const createReglaMantenimientoSchema = z.object({
  clienteId: z.string().trim().min(1).optional(),
  tipoServicio: z.enum(TIPO_SERVICIO),
  tipoMatafuego: z.enum(TIPO_MATAFUEGO).optional(),
  agenteExtintor: z.enum(AGENTE_EXTINTOR).optional(),
  frecuenciaMeses: z.number().int().positive().max(120, "La frecuencia no puede superar los 120 meses (10 años)"),
  normaTecnica: z.string().trim().max(150).optional(),
  jurisdiccion: z.string().trim().max(150).optional(),
  descripcion: z.string().trim().max(500).optional(),
});
export type CreateReglaMantenimientoInput = z.input<typeof createReglaMantenimientoSchema>;

export const createMantenimientoProgramadoSchema = z.object({
  matafuegoId: z.string().trim().min(1, "El matafuego es obligatorio"),
  tipoServicio: z.enum(TIPO_SERVICIO),
  fechaProgramada: z.coerce.date(),
  tecnicoAsignadoId: z.string().trim().min(1).optional(),
  prioridad: z.enum(["BAJA", "MEDIA", "ALTA", "URGENTE"]).default("MEDIA"),
  motivo: z.string().trim().max(1000).optional(),
  observaciones: z.string().trim().max(2000).optional(),
});
export type CreateMantenimientoProgramadoInput = z.input<typeof createMantenimientoProgramadoSchema>;

export const reprogramarMantenimientoSchema = z.object({
  fechaProgramada: z.coerce.date(),
  motivo: z.string().trim().max(1000).optional(),
});
export type ReprogramarMantenimientoInput = z.input<typeof reprogramarMantenimientoSchema>;

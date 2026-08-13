import { z } from "zod";

const ORIGEN = ["MANUAL", "INSPECCION", "VENCIMIENTO", "PRESUPUESTO", "NO_CONFORMIDAD", "SOLICITUD_CLIENTE", "MANTENIMIENTO_PROGRAMADO"] as const;
const PRIORIDAD = ["BAJA", "NORMAL", "ALTA", "URGENTE"] as const;

const camposComunesOrden = {
  prioridad: z.enum(PRIORIDAD).default("NORMAL"),
  tecnicoAsignadoId: z.string().min(1).optional(),
  fechaProgramada: z.coerce.date().optional(),
  observaciones: z.string().trim().max(2000).optional(),
};

export const createOrdenTrabajoSchema = z.object({
  clienteId: z.string().min(1, "El cliente es obligatorio"),
  establecimientoId: z.string().min(1).optional(),
  origen: z.enum(ORIGEN).default("MANUAL"),
  matafuegoIds: z.array(z.string().min(1)).default([]),
  ...camposComunesOrden,
});
export type CreateOrdenTrabajoInput = z.input<typeof createOrdenTrabajoSchema>;

/** Subconjunto usado por los atajos crearOrdenDesde* (RF-11): cliente,
 * establecimiento, unidad y origen los deriva el propio atajo a partir del
 * registro de origen (inspección/no conformidad/mantenimiento), así que acá
 * sólo se validan los campos que el llamador realmente puede elegir. */
export const crearOrdenDesdeOrigenSchema = z.object(camposComunesOrden);
export type CrearOrdenDesdeOrigenInput = z.input<typeof crearOrdenDesdeOrigenSchema>;

export const updateOrdenTrabajoSchema = z.object({
  establecimientoId: z.string().min(1).optional(),
  prioridad: z.enum(PRIORIDAD).optional(),
  fechaProgramada: z.coerce.date().optional(),
  observaciones: z.string().trim().max(2000).optional(),
});
export type UpdateOrdenTrabajoInput = z.input<typeof updateOrdenTrabajoSchema>;

/** Campos que un técnico asignado (alcance PROPIO) puede completar mientras
 * ejecuta el trabajo, sin poder reasignarse a sí mismo ni tocar datos
 * comerciales de la orden. */
export const registrarAvanceTecnicoSchema = z.object({
  horasTrabajadas: z.number().nonnegative().optional(),
  repuestosUtilizados: z.string().trim().max(2000).optional(),
  resultadoTecnico: z.string().trim().max(2000).optional(),
  observaciones: z.string().trim().max(2000).optional(),
});
export type RegistrarAvanceTecnicoInput = z.input<typeof registrarAvanceTecnicoSchema>;

export const asignarTecnicoSchema = z.object({
  tecnicoAsignadoId: z.string().min(1, "El técnico es obligatorio"),
});
export type AsignarTecnicoInput = z.input<typeof asignarTecnicoSchema>;

export const agregarItemOrdenSchema = z.object({
  servicioId: z.string().min(1, "El servicio es obligatorio"),
  matafuegoId: z.string().min(1).optional(),
  cantidad: z.number().int().positive().default(1),
});
export type AgregarItemOrdenInput = z.input<typeof agregarItemOrdenSchema>;

export const actualizarCantidadItemSchema = z.object({
  cantidad: z.number().int().positive("La cantidad debe ser mayor a cero"),
});
export type ActualizarCantidadItemInput = z.input<typeof actualizarCantidadItemSchema>;

export const finalizarOrdenSchema = z.object({
  resultadoTecnico: z.string().trim().min(1, "El resultado técnico es obligatorio para finalizar"),
  horasTrabajadas: z.number().nonnegative().optional(),
});
export type FinalizarOrdenInput = z.input<typeof finalizarOrdenSchema>;

import { z } from "zod";

export const registrarRetiroSchema = z.object({
  matafuegoId: z.string().min(1, "El matafuego es obligatorio"),
  ordenTrabajoId: z.string().min(1).optional(),
  tecnicoResponsableId: z.string().min(1).optional(),
  personaQueEntrega: z.string().trim().max(200).optional(),
  personaQueRetira: z.string().trim().max(200).optional(),
  vehiculo: z.string().trim().max(150).optional(),
  destino: z.string().trim().max(200).optional(),
  estadoUnidadRetiro: z.string().trim().max(500).optional(),
  observaciones: z.string().trim().max(2000).optional(),
});
export type RegistrarRetiroInput = z.input<typeof registrarRetiroSchema>;

export const ingresarATallerSchema = z.object({
  personaQueRecibe: z.string().trim().min(1, "La persona que recibe es obligatoria").max(200),
  ubicacionInterna: z.string().trim().max(200).optional(),
});
export type IngresarATallerInput = z.input<typeof ingresarATallerSchema>;

export const actualizarUbicacionInternaSchema = z.object({
  ubicacionInterna: z.string().trim().min(1, "La ubicación interna es obligatoria").max(200),
});
export type ActualizarUbicacionInternaInput = z.input<typeof actualizarUbicacionInternaSchema>;

export const registrarEntregaSchema = z.object({
  personaQueRecibe: z.string().trim().min(1, "La persona que recibe la entrega es obligatoria").max(200),
  firmaRecepcionNombre: z.string().trim().min(1, "La firma de recepción es obligatoria para cerrar la cadena de custodia").max(200),
});
export type RegistrarEntregaInput = z.input<typeof registrarEntregaSchema>;

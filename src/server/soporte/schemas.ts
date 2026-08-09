import { z } from "zod";

export const prioridadTicketSchema = z.enum(["BAJA", "NORMAL", "ALTA", "URGENTE"]);
export const estadoTicketSchema = z.enum(["ABIERTO", "EN_PROGRESO", "RESUELTO", "CERRADO"]);

export const crearTicketSchema = z.object({
  asunto: z.string().trim().min(1).max(200),
  mensaje: z.string().trim().min(1).max(5000),
  prioridad: prioridadTicketSchema.optional(),
});

export const responderTicketSchema = z.object({
  cuerpo: z.string().trim().min(1).max(5000),
});

export const cambiarEstadoTicketSchema = z.object({
  estado: estadoTicketSchema,
});

export type CrearTicketInput = z.input<typeof crearTicketSchema>;
export type ResponderTicketInput = z.input<typeof responderTicketSchema>;
export type CambiarEstadoTicketInput = z.input<typeof cambiarEstadoTicketSchema>;

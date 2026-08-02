import { z } from "zod";

export const createNoConformidadSchema = z.object({
  matafuegoId: z.string().trim().min(1, "El matafuego es obligatorio"),
  inspeccionId: z.string().trim().min(1).optional(),
  tipoDefecto: z.string().trim().min(1, "El tipo de defecto es obligatorio").max(150),
  descripcion: z.string().trim().min(1, "La descripción es obligatoria").max(2000),
  severidad: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]),
  nivelRiesgo: z.enum(["BAJO", "MEDIO", "ALTO", "CRITICO"]),
  accionInmediata: z.string().trim().max(1000).optional(),
  fechaLimite: z.coerce.date().optional(),
  reinspeccionRequerida: z.boolean().default(false),
});

export type CreateNoConformidadInput = z.input<typeof createNoConformidadSchema>;

export const asignarResponsableSchema = z.object({
  responsableId: z.string().trim().min(1, "El responsable es obligatorio"),
});

export const resolverNoConformidadSchema = z.object({
  resolucion: z.string().trim().min(1, "La resolución es obligatoria").max(2000),
});

export const motivoOpcionalSchema = z.object({
  motivo: z.string().trim().max(500).optional(),
});

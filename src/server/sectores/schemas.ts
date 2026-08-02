import { z } from "zod";

const baseSectorSchema = z.object({
  establecimientoId: z.string().trim().min(1, "El establecimiento es obligatorio"),
  parentSectorId: z.string().trim().min(1).optional(),
  nombre: z.string().trim().min(1, "El nombre del sector es obligatorio").max(150),
  responsable: z.string().trim().max(200).optional(),
  observaciones: z.string().trim().max(2000).optional(),
});

export const createSectorSchema = baseSectorSchema;

// establecimientoId y parentSectorId no se editan acá: reubicar un sector (o su
// jerarquía) es una operación distinta, fuera del alcance de los criterios de
// aceptación de RF-03. Se agrega como acción explícita si hace falta.
export const updateSectorSchema = baseSectorSchema.omit({ establecimientoId: true, parentSectorId: true }).partial();

export type CreateSectorInput = z.input<typeof createSectorSchema>;
export type UpdateSectorInput = z.input<typeof updateSectorSchema>;

const baseUbicacionSchema = z.object({
  sectorId: z.string().trim().min(1, "El sector es obligatorio"),
  nombre: z.string().trim().min(1, "El nombre de la ubicación es obligatorio").max(150),
  descripcion: z.string().trim().max(1000).optional(),
});

export const createUbicacionSchema = baseUbicacionSchema;
export const updateUbicacionSchema = baseUbicacionSchema.omit({ sectorId: true }).partial();

export type CreateUbicacionInput = z.input<typeof createUbicacionSchema>;
export type UpdateUbicacionInput = z.input<typeof updateUbicacionSchema>;

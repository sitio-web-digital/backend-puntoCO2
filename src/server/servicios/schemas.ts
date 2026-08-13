import { z } from "zod";

const CATEGORIA = [
  "RECARGA",
  "PRUEBA_HIDRAULICA",
  "PINTURA",
  "REPARACION",
  "CAMBIO_AGENTE",
  "INSPECCION",
  "MANTENIMIENTO",
  "REEMPLAZO_REPUESTOS",
  "VENTA",
  "INSTALACION",
  "RETIRO_ENTREGA",
  "OTRO",
] as const;
const AGENTE_EXTINTOR = ["POLVO_QUIMICO_ABC", "CO2", "AGUA", "ESPUMA", "AGENTE_LIMPIO", "OTRO"] as const;

const baseServicioSchema = z.object({
  codigo: z.string().trim().min(1, "El código es obligatorio").max(50),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  categoria: z.enum(CATEGORIA),
  descripcion: z.string().trim().max(2000).optional(),
  precioBase: z.number().nonnegative("El precio base no puede ser negativo"),
  costoEstimado: z.number().nonnegative().optional(),
  iva: z.number().min(0).max(100).default(21),
  moneda: z.enum(["ARS", "USD"]).default("ARS"),
  duracionEstimadaMinutos: z.number().int().positive().optional(),
  agentesCompatibles: z.array(z.enum(AGENTE_EXTINTOR)).default([]),
  capacidadesCompatibles: z.array(z.string().trim().min(1)).default([]),
  requiereRetiro: z.boolean().default(false),
  requiereEnsayo: z.boolean().default(false),
  requiereRepuestos: z.boolean().default(false),
  requiereCertificado: z.boolean().default(false),
  vigenteDesde: z.coerce.date().optional(),
  vigenteHasta: z.coerce.date().optional(),
});

export const createServicioSchema = baseServicioSchema;
export type CreateServicioInput = z.input<typeof createServicioSchema>;

export const updateServicioSchema = baseServicioSchema.partial();
export type UpdateServicioInput = z.input<typeof updateServicioSchema>;

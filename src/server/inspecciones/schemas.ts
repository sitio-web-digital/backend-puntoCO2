import { z } from "zod";

// matafuegoId, establecimientoId, tecnicoId, ubicacionRegistradaId y fechaHora
// NO se aceptan del cliente: se derivan en el servicio (del matafuego y del
// actor autenticado) para que nadie pueda registrar una inspección a nombre
// de otro técnico, en un establecimiento distinto al real, o con una fecha
// que no sea la del servidor.
export const createInspeccionSchema = z.object({
  matafuegoId: z.string().trim().min(1, "El matafuego es obligatorio"),
  ubicacionDetectadaId: z.string().trim().min(1).optional(),
  resultado: z.enum(["APTO", "APTO_CON_OBSERVACIONES", "REQUIERE_MANTENIMIENTO", "REQUIERE_RECARGA", "REQUIERE_REEMPLAZO", "NO_ENCONTRADO", "ACCESO_IMPOSIBLE"]),
  comentarios: z.string().trim().max(2000).optional(),
  firmaResponsableNombre: z.string().trim().max(200).optional(),
  latitud: z.number().min(-90).max(90).optional(),
  longitud: z.number().min(-180).max(180).optional(),
  dispositivo: z.string().trim().max(150).optional(),
  estadoSincronizacion: z.enum(["SINCRONIZADO", "PENDIENTE"]).default("SINCRONIZADO"),

  equipoPresente: z.boolean().optional(),
  accesoLibre: z.boolean().optional(),
  senalizacionVisible: z.boolean().optional(),
  soporteFirme: z.boolean().optional(),
  ausenciaDanios: z.boolean().optional(),
  ausenciaCorrosion: z.boolean().optional(),
  mangueraEnBuenEstado: z.boolean().optional(),
  boquillaSinObstrucciones: z.boolean().optional(),
  precintoIntacto: z.boolean().optional(),
  pasadorSeguridadColocado: z.boolean().optional(),
  manometroDentroDeRango: z.boolean().optional(),
  pesoDentroDeTolerancia: z.boolean().optional(),
  etiquetaLegible: z.boolean().optional(),
  fechaVigente: z.boolean().optional(),
  sinIndiciosDeDescarga: z.boolean().optional(),
  ubicacionCorrecta: z.boolean().optional(),
  fotografiaGeneral: z.boolean().optional(),
  fotografiaEtiqueta: z.boolean().optional(),
  fotografiaManometro: z.boolean().optional(),
});

export type CreateInspeccionInput = z.input<typeof createInspeccionSchema>;

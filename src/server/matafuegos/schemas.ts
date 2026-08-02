import { z } from "zod";

const fecha = z.coerce.date();

export const createMatafuegoSchema = z.object({
  codigoInterno: z.string().trim().min(1, "El código interno es obligatorio").max(100),
  numeroSerie: z.string().trim().min(1, "El número de serie es obligatorio").max(150),
  codigoBarras: z.string().trim().max(150).optional(),
  clienteId: z.string().trim().min(1, "El cliente propietario es obligatorio"),
  establecimientoId: z.string().trim().min(1, "El establecimiento es obligatorio"),
  sectorId: z.string().trim().min(1).optional(),
  ubicacionId: z.string().trim().min(1).optional(),
  tipo: z.enum(["PORTATIL", "RODANTE", "VEHICULAR", "OTRO"]),
  agenteExtintor: z.enum(["POLVO_QUIMICO_ABC", "CO2", "AGUA", "ESPUMA", "AGENTE_LIMPIO", "OTRO"]),
  capacidadNominal: z.string().trim().max(50).optional(),
  marca: z.string().trim().max(150).optional(),
  modelo: z.string().trim().max(150).optional(),
  fabricante: z.string().trim().max(150).optional(),
  fechaFabricacion: fecha.optional(),
  fechaPuestaServicio: fecha.optional(),
  pesoNominal: z.number().positive().optional(),
  normaTecnica: z.string().trim().max(150).optional(),
  observaciones: z.string().trim().max(2000).optional(),
});

// Campos que un rol con alcance no-TODAS puede tocar (relevamiento físico de
// un técnico durante una inspección/control), definidos en un único lugar
// que schemas.ts y service.ts comparten para no desincronizarse.
export const CAMPOS_OPERATIVOS_MATAFUEGO = [
  "pesoVerificado",
  "estadoManometro",
  "estadoMangueraBoquilla",
  "estadoPrecinto",
  "estadoSoporteGabinete",
  "observaciones",
  "fechaUltimaInspeccion",
  "fechaUltimoControl",
] as const;

// clienteId/establecimientoId no se editan acá (transferir un matafuego a otro
// cliente/establecimiento es una operación distinta). sectorId/ubicacionId
// tampoco: cambiar de ubicación pasa por moverMatafuego(), que además registra
// el movimiento en el historial — un update directo lo dejaría sin trazar.
export const updateMatafuegoSchema = z.object({
  codigoInterno: z.string().trim().min(1).max(100).optional(),
  numeroSerie: z.string().trim().min(1).max(150).optional(),
  codigoBarras: z.string().trim().max(150).optional(),
  tipo: z.enum(["PORTATIL", "RODANTE", "VEHICULAR", "OTRO"]).optional(),
  agenteExtintor: z.enum(["POLVO_QUIMICO_ABC", "CO2", "AGUA", "ESPUMA", "AGENTE_LIMPIO", "OTRO"]).optional(),
  capacidadNominal: z.string().trim().max(50).optional(),
  marca: z.string().trim().max(150).optional(),
  modelo: z.string().trim().max(150).optional(),
  fabricante: z.string().trim().max(150).optional(),
  fechaFabricacion: fecha.optional(),
  fechaPuestaServicio: fecha.optional(),
  fechaUltimaInspeccion: fecha.optional(),
  fechaUltimoControl: fecha.optional(),
  fechaUltimoMantenimiento: fecha.optional(),
  fechaUltimaRecarga: fecha.optional(),
  fechaUltimaPruebaHidraulica: fecha.optional(),
  proximaInspeccion: fecha.optional(),
  proximoMantenimiento: fecha.optional(),
  proximaRecarga: fecha.optional(),
  proximaPruebaHidraulica: fecha.optional(),
  pesoNominal: z.number().positive().optional(),
  pesoVerificado: z.number().positive().optional(),
  estadoManometro: z.string().trim().max(100).optional(),
  estadoMangueraBoquilla: z.string().trim().max(100).optional(),
  estadoPrecinto: z.string().trim().max(100).optional(),
  estadoSoporteGabinete: z.string().trim().max(100).optional(),
  normaTecnica: z.string().trim().max(150).optional(),
  observaciones: z.string().trim().max(2000).optional(),
});

export const moverMatafuegoSchema = z.object({
  sectorDestinoId: z.string().trim().min(1).optional(),
  ubicacionDestinoId: z.string().trim().min(1).optional(),
  motivo: z.string().trim().max(500).optional(),
});

export type CreateMatafuegoInput = z.input<typeof createMatafuegoSchema>;
export type UpdateMatafuegoInput = z.input<typeof updateMatafuegoSchema>;
export type MoverMatafuegoInput = z.input<typeof moverMatafuegoSchema>;

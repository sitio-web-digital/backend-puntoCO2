import { z } from "zod";

const baseEstablecimientoSchema = z.object({
  clienteId: z.string().trim().min(1, "El cliente propietario es obligatorio"),
  nombre: z.string().trim().min(1, "El nombre o identificación de la sede es obligatorio").max(200),
  direccion: z.string().trim().max(300).optional(),
  provincia: z.string().trim().max(100).optional(),
  localidad: z.string().trim().max(100).optional(),
  codigoPostal: z.string().trim().max(20).optional(),
  latitud: z.number().min(-90).max(90).optional(),
  longitud: z.number().min(-180).max(180).optional(),
  responsableSeguridad: z.string().trim().max(200).optional(),
  contactoOperativo: z.string().trim().max(200).optional(),
  email: z.string().trim().email().optional(),
  telefono: z.string().trim().max(30).optional(),
  horariosAtencion: z.string().trim().max(300).optional(),
  indicacionesAcceso: z.string().trim().max(1000).optional(),
  normativaAplicable: z.string().trim().max(300).optional(),
  observaciones: z.string().trim().max(2000).optional(),
});

export const createEstablecimientoSchema = baseEstablecimientoSchema;

// clienteId no se puede editar acá: mover un establecimiento a otro cliente es
// una operación distinta (con implicancias sobre matafuegos/órdenes ya
// vinculados) que no está pedida por RF-02. Si hace falta, se agrega como
// acción explícita más adelante. `.omit` lo saca del todo del schema (y del
// tipo), así que si llega en el body simplemente se ignora, como cualquier
// otro campo no reconocido.
export const updateEstablecimientoSchema = baseEstablecimientoSchema.omit({ clienteId: true }).partial();

export type CreateEstablecimientoInput = z.input<typeof createEstablecimientoSchema>;
export type UpdateEstablecimientoInput = z.input<typeof updateEstablecimientoSchema>;

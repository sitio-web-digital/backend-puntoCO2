import { z } from "zod";

export const cancelarNotificacionSchema = z.object({
  motivo: z.string().trim().max(1000).optional(),
});
export type CancelarNotificacionInput = z.input<typeof cancelarNotificacionSchema>;

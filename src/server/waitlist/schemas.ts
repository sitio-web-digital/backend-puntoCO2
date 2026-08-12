import { z } from "zod";

export const anotarseWaitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido").max(200),
  telefono: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+\s()-]*$/, "El teléfono sólo admite números, espacios y + ( ) -"),
});

export type AnotarseWaitlistInput = z.input<typeof anotarseWaitlistSchema>;

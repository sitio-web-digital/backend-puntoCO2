import { z } from "zod";

export const anotarseWaitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido").max(200),
});

export type AnotarseWaitlistInput = z.input<typeof anotarseWaitlistSchema>;

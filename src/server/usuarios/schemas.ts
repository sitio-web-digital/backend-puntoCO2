import { z } from "zod";

export const invitarUsuarioSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(12, "La contraseña debe tener al menos 12 caracteres"),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  apellido: z.string().trim().min(1, "El apellido es obligatorio").max(100),
  rolIds: z.array(z.string().min(1)).min(1, "Debe asignarse al menos un rol"),
});
export type InvitarUsuarioInput = z.input<typeof invitarUsuarioSchema>;

export const actualizarUsuarioSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  apellido: z.string().trim().min(1).max(100).optional(),
  estado: z.enum(["ACTIVO", "SUSPENDIDO", "DADO_DE_BAJA"]).optional(),
});
export type ActualizarUsuarioInput = z.input<typeof actualizarUsuarioSchema>;

export const asignarRolesSchema = z.object({
  rolIds: z.array(z.string().min(1)).min(1, "Debe asignarse al menos un rol"),
});
export type AsignarRolesInput = z.input<typeof asignarRolesSchema>;

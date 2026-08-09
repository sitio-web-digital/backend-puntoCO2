import { Prisma } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "../auth/password";
import type { TenantTx } from "../db/with-tenant";
import { withTenant } from "../db/with-tenant";
import { writeAudit } from "../audit/log";
import { seedDefaultRolesForTenant } from "../rbac/default-roles";

export const createTenantSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  slug: z
    .string()
    .trim()
    .min(3, "El slug debe tener al menos 3 caracteres")
    .max(63)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "El slug sólo admite minúsculas, números y guiones (ej: acme-matafuegos)"),
  cuit: z.string().trim().min(1).max(20).optional(),
  adminEmail: z.string().trim().email("Email inválido"),
  adminPassword: z.string().min(12, "La contraseña debe tener al menos 12 caracteres"),
  adminNombre: z.string().trim().min(1).max(100),
  adminApellido: z.string().trim().min(1).max(100),
  trialDias: z.number().int().min(1).max(365).default(14),
});

export type CreateTenantInput = z.input<typeof createTenantSchema>;

export class SlugAlreadyExistsError extends Error {
  constructor(slug: string) {
    super(`Ya existe una empresa registrada con el identificador "${slug}"`);
    this.name = "SlugAlreadyExistsError";
  }
}

export class DefaultRoleMissingError extends Error {
  constructor(nombre: string) {
    super(`El rol por defecto "${nombre}" no fue sembrado correctamente`);
    this.name = "DefaultRoleMissingError";
  }
}

interface CreateTenantActor {
  /** Usuario superadmin SaaS que ejecuta el alta, o null si es un script de bootstrap. */
  usuarioId: string | null;
}

/**
 * Da de alta un tenant nuevo: crea la empresa, siembra los 9 roles por
 * defecto de RF-27 y crea su primer usuario con el rol "Administrador de
 * empresa". Todo en una única transacción: si algo falla, no queda un tenant
 * a medio crear sin usuarios que puedan operarlo.
 *
 * Es una operación de plataforma (la ejecuta el Superadministrador SaaS o el
 * script de bootstrap inicial), por eso corre con bypassRls: el tenant recién
 * creado todavía no existe como contexto de sesión al momento de insertarlo.
 */
export async function createTenant(rawInput: CreateTenantInput, actor: CreateTenantActor) {
  const input = createTenantSchema.parse(rawInput);
  const passwordHash = await hashPassword(input.adminPassword);
  const vigenciaHasta = new Date(Date.now() + input.trialDias * 24 * 60 * 60 * 1000);

  try {
    return await withTenant({ tenantId: null, bypassRls: true }, async (tx: TenantTx) => {
      const tenant = await tx.tenant.create({
        data: {
          nombre: input.nombre,
          slug: input.slug,
          cuit: input.cuit ?? null,
          estado: "TRIAL",
          vigenciaHasta,
        },
      });

      const rolIdByNombre = await seedDefaultRolesForTenant(tx, tenant.id);
      const adminRolId = rolIdByNombre.get("Administrador de empresa");
      if (!adminRolId) {
        throw new DefaultRoleMissingError("Administrador de empresa");
      }

      const usuarioAdmin = await tx.usuario.create({
        data: {
          tenantId: tenant.id,
          email: input.adminEmail,
          passwordHash,
          nombre: input.adminNombre,
          apellido: input.adminApellido,
          roles: { create: { rolId: adminRolId } },
        },
        omit: { passwordHash: true },
      });

      await writeAudit(tx, {
        tenantId: tenant.id,
        usuarioId: actor.usuarioId,
        accion: "CREATE",
        entidad: "Tenant",
        entidadId: tenant.id,
        valorNuevo: { nombre: tenant.nombre, slug: tenant.slug, adminEmail: usuarioAdmin.email },
      });

      return { tenant, usuarioAdmin };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new SlugAlreadyExistsError(input.slug);
    }
    throw err;
  }
}

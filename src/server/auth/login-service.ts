import { z } from "zod";
import { prisma } from "../db/client";
import { withTenant } from "../db/with-tenant";
import { writeAudit } from "../audit/log";
import { hashPassword, verifyPassword } from "./password";
import { signAccessToken } from "./tokens";
import { createSession } from "./session-service";

export const loginSchema = z.object({
  // Ausente = intento de login del Superadministrador SaaS (sin tenant). Presente =
  // login de un usuario de esa empresa. No exponemos si el slug existe o no en los
  // mensajes de error: siempre "credenciales inválidas" para no filtrar qué empresas
  // están registradas en la plataforma.
  slug: z.string().trim().min(1).optional(),
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

interface SessionMeta {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export type LoginResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      usuario: { id: string; email: string; nombre: string; apellido: string; tenantId: string | null; esSuperAdminSaas: boolean };
    }
  | { ok: false; reason: "invalid_credentials" | "tenant_inactive" };

const ESTADOS_TENANT_QUE_PERMITEN_LOGIN = new Set(["TRIAL", "ACTIVO"]);

let dummyHashPromise: Promise<string> | null = null;
/** Hash "señuelo" contra el que igual corremos argon2 cuando el usuario no existe,
 * para que el tiempo de respuesta no delate si el email/slug es válido o no. */
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword("dummy-password-para-tiempo-constante-de-login");
  }
  return dummyHashPromise;
}

export async function login(rawInput: LoginInput, meta: SessionMeta = {}): Promise<LoginResult> {
  const input = loginSchema.parse(rawInput);

  if (input.slug) {
    return loginTenantUser(input.slug, input.email, input.password, meta);
  }
  return loginSuperAdmin(input.email, input.password, meta);
}

async function loginTenantUser(slug: string, email: string, password: string, meta: SessionMeta): Promise<LoginResult> {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });

  if (!tenant) {
    await verifyPassword(await getDummyHash(), password);
    return { ok: false, reason: "invalid_credentials" };
  }

  if (!ESTADOS_TENANT_QUE_PERMITEN_LOGIN.has(tenant.estado)) {
    return { ok: false, reason: "tenant_inactive" };
  }

  const usuario = await withTenant({ tenantId: tenant.id }, (tx) => tx.usuario.findUnique({ where: { tenantId_email: { tenantId: tenant.id, email } } }));

  return finishLogin(usuario, password, meta);
}

async function loginSuperAdmin(email: string, password: string, meta: SessionMeta): Promise<LoginResult> {
  const usuario = await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
    tx.usuario.findFirst({ where: { tenantId: null, email, esSuperAdminSaas: true } }),
  );

  return finishLogin(usuario, password, meta);
}

async function finishLogin(
  usuario: Awaited<ReturnType<typeof prisma.usuario.findUnique>> | null,
  password: string,
  meta: SessionMeta,
): Promise<LoginResult> {
  if (!usuario || usuario.estado !== "ACTIVO") {
    await verifyPassword(await getDummyHash(), password);
    return { ok: false, reason: "invalid_credentials" };
  }

  const passwordValid = await verifyPassword(usuario.passwordHash, password);
  if (!passwordValid) {
    await writeFailedLoginAudit(usuario.tenantId, usuario.id);
    return { ok: false, reason: "invalid_credentials" };
  }

  const accessToken = await signAccessToken({
    sub: usuario.id,
    tenantId: usuario.tenantId,
    esSuperAdminSaas: usuario.esSuperAdminSaas,
  });
  const { refreshToken } = await createSession(usuario.id, meta);

  await withTenant({ tenantId: usuario.tenantId, bypassRls: usuario.tenantId === null }, (tx) =>
    writeAudit(tx, {
      tenantId: usuario.tenantId,
      usuarioId: usuario.id,
      accion: "LOGIN",
      entidad: "Usuario",
      entidadId: usuario.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    }),
  );

  return {
    ok: true,
    accessToken,
    refreshToken,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      tenantId: usuario.tenantId,
      esSuperAdminSaas: usuario.esSuperAdminSaas,
    },
  };
}

async function writeFailedLoginAudit(tenantId: string | null, usuarioId: string) {
  await withTenant({ tenantId, bypassRls: tenantId === null }, (tx) =>
    writeAudit(tx, { tenantId, usuarioId, accion: "LOGIN_FAILED", entidad: "Usuario", entidadId: usuarioId }),
  );
}

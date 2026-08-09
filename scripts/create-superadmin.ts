/**
 * Crea (o promueve) al Superadministrador SaaS inicial de la plataforma.
 *
 * En desarrollo esto ya lo hace `prisma/seed.ts` con credenciales fijas. Este
 * script es el equivalente para producción: lee los datos de variables de
 * entorno (nunca hardcodeados) y se corre una sola vez desde el proceso de
 * despliegue, con acceso directo a la base — no hay ni debe haber ninguna
 * ruta de API pública que dé de alta un superadmin.
 *
 * Uso:
 *   SUPERADMIN_EMAIL=vos@empresa.com SUPERADMIN_PASSWORD='...' \
 *   SUPERADMIN_NOMBRE=Nombre SUPERADMIN_APELLIDO=Apellido \
 *   npx tsx scripts/create-superadmin.ts
 */
import "dotenv/config";
import { prisma } from "../src/server/db/client";
import { withTenant } from "../src/server/db/with-tenant";
import { hashPassword } from "../src/server/auth/password";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value.trim();
}

async function main() {
  const email = requireEnv("SUPERADMIN_EMAIL");
  const password = requireEnv("SUPERADMIN_PASSWORD");
  const nombre = requireEnv("SUPERADMIN_NOMBRE");
  const apellido = requireEnv("SUPERADMIN_APELLIDO");

  if (password.length < 12) {
    throw new Error("SUPERADMIN_PASSWORD debe tener al menos 12 caracteres");
  }

  const existente = await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
    tx.usuario.findFirst({ where: { tenantId: null, email, esSuperAdminSaas: true } }),
  );
  if (existente) {
    console.warn(`Ya existe un superadmin con ese email: ${email}. No se crea uno nuevo.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
    tx.usuario.create({
      data: { tenantId: null, email, passwordHash, nombre, apellido, esSuperAdminSaas: true },
    }),
  );

  console.warn(`Superadmin creado: ${email}. Iniciá sesión en /admin/login.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

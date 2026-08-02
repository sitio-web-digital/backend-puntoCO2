/**
 * Seed de desarrollo: crea el Superadministrador SaaS inicial (necesario para
 * poder loguearse y, eventualmente, dar de alta tenants desde la app) y una
 * empresa de prueba con su administrador, para tener algo con qué probar sin
 * pasar por un flujo manual.
 *
 * NO se corre en producción: ahí el superadmin inicial se crea con un script
 * de despliegue aparte que lee la contraseña de un secreto real, no de un
 * valor hardcodeado como acá.
 */
import "dotenv/config";
import { prisma } from "../src/server/db/client";
import { hashPassword } from "../src/server/auth/password";
import { createTenant } from "../src/server/tenants/provisioning";
import { withTenant } from "../src/server/db/with-tenant";

const SUPERADMIN_EMAIL = "superadmin@matafuego.local";
const SUPERADMIN_PASSWORD_DEV_ONLY = "superadmin-dev-only-12345";

const DEMO_TENANT_SLUG = "demo";
const DEMO_ADMIN_EMAIL = "admin@demo.local";
const DEMO_ADMIN_PASSWORD_DEV_ONLY = "demo-admin-dev-only-12345";

async function ensureSuperAdmin() {
  const existing = await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
    tx.usuario.findFirst({ where: { tenantId: null, email: SUPERADMIN_EMAIL, esSuperAdminSaas: true } }),
  );
  if (existing) {
    console.warn(`Superadmin ya existe: ${SUPERADMIN_EMAIL}`);
    return;
  }

  const passwordHash = await hashPassword(SUPERADMIN_PASSWORD_DEV_ONLY);
  await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
    tx.usuario.create({
      data: {
        tenantId: null,
        email: SUPERADMIN_EMAIL,
        passwordHash,
        nombre: "Super",
        apellido: "Admin",
        esSuperAdminSaas: true,
      },
    }),
  );
  console.warn(`Superadmin creado: ${SUPERADMIN_EMAIL} / ${SUPERADMIN_PASSWORD_DEV_ONLY}`);
}

async function ensureDemoTenant() {
  const existing = await prisma.tenant.findUnique({ where: { slug: DEMO_TENANT_SLUG } });
  if (existing) {
    console.warn(`Tenant demo ya existe: ${DEMO_TENANT_SLUG}`);
    return;
  }

  await createTenant(
    {
      nombre: "Matafuegos Demo S.A.",
      slug: DEMO_TENANT_SLUG,
      adminEmail: DEMO_ADMIN_EMAIL,
      adminPassword: DEMO_ADMIN_PASSWORD_DEV_ONLY,
      adminNombre: "Admin",
      adminApellido: "Demo",
    },
    { usuarioId: null },
  );
  console.warn(`Tenant demo creado: slug="${DEMO_TENANT_SLUG}", admin=${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD_DEV_ONLY}`);
}

async function main() {
  await ensureSuperAdmin();
  await ensureDemoTenant();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

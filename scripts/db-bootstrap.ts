/**
 * Bootstrap de la base de datos local de desarrollo:
 * 1. Levanta Postgres (docker compose).
 * 2. Espera a que acepte conexiones.
 * 3. Aplica las migraciones (crea, entre otras cosas, el rol `app_user`).
 * 4. Fija la contraseña local de `app_user` (fija y de dev, igual que la del
 *    superusuario en docker-compose.yml — no es sensible fuera de este entorno).
 *
 * En producción, `app_user` y su contraseña se provisionan a través del
 * proceso de gestión de secretos del proveedor gestionado (Neon/Supabase),
 * nunca con este script.
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const APP_USER_DEV_PASSWORD = "app_user_dev_only";

function run(cmd: string) {
  console.warn(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

function waitForDb() {
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      execSync("docker exec matafuegosaas-db-1 pg_isready -U matafuego -d matafuego_saas", { stdio: "ignore" });
      return;
    } catch {
      if (attempt === maxAttempts) {
        throw new Error("Postgres no respondió a tiempo (30 intentos).");
      }
      execSync("sleep 2");
    }
  }
}

async function setAppUserPassword() {
  const admin = new PrismaClient();
  try {
    await admin.$executeRawUnsafe(`ALTER ROLE app_user WITH PASSWORD '${APP_USER_DEV_PASSWORD}'`);
  } finally {
    await admin.$disconnect();
  }
}

async function main() {
  run("docker compose up -d");
  waitForDb();
  run("npx prisma migrate deploy");
  await setAppUserPassword();
  console.warn("\nListo. RUNTIME_DATABASE_URL debe usar la contraseña 'app_user_dev_only' para el usuario app_user.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

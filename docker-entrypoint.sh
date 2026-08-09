#!/bin/sh
set -e

# Aplica migraciones pendientes contra DATABASE_URL (rol dueño de las
# tablas) antes de levantar la app. No crea el rol de mínimo privilegio
# app_user ni sus políticas de RLS — eso es `npm run db:bootstrap`, un paso
# manual de una sola vez contra una base nueva (ver .env.example), no algo
# para repetir en cada deploy.
echo "Aplicando migraciones..."
npx prisma migrate deploy

echo "Iniciando Next.js..."
exec npm run start

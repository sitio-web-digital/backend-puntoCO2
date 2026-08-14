# Imagen para el deploy self-hosted (ver .github/workflows/deploy-backend.yml).
# Debian slim en vez de alpine: argon2 (hash de contraseñas) tiene bindings
# nativos que en musl (alpine) suelen requerir toolchain extra para compilar;
# glibc evita ese problema de entrada.
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# libssl: Prisma lo necesita para el query engine; bookworm-slim no lo trae.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# scripts/ tiene que estar ANTES de npm ci: el postinstall
# (scripts/copy-qr-worker.js) corre como parte de npm ci y falla si el
# archivo todavía no existe en la imagen en ese punto.
COPY scripts ./scripts
RUN npm ci

COPY . .

# next build no toca la base real, pero sí instancia el cliente de Prisma en
# algunos módulos a nivel de import (mismo motivo que en .github/workflows/ci.yml
# del job "build"): alcanza con una URL sintácticamente válida.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV RUNTIME_DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV AUTH_SECRET="build-only-placeholder-nunca-se-usa-en-runtime"

RUN npx prisma generate
RUN npm run build

# ---- Runtime ----
# Se mantiene node_modules completo (con devDependencies) porque el
# entrypoint corre `prisma migrate deploy`, y el paquete `prisma` (CLI) es
# una devDependency — no está pensado para minimizar tamaño de imagen, sino
# para que las migraciones corran sin instalar nada aparte en el arranque.
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
# src/app/home/route.ts lee landing.html del disco en tiempo de ejecución
# (no queda inlineado en .next), así que necesita el árbol de fuentes real
# presente en el runner, no sólo el build compilado.
COPY --from=builder /app/src ./src
# next start sirve public/ leyendo el disco directamente (no queda empaquetado
# en .next tampoco) — mismo motivo que src/ arriba.
COPY --from=builder /app/public ./public
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Puramente informativo: con --network host (ver el workflow de deploy) el
# puerto real lo define $PORT en el .env del runner, no este EXPOSE.
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]

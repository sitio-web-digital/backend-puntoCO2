-- CreateEnum
CREATE TYPE "EstadoTicketSoporte" AS ENUM ('ABIERTO', 'EN_PROGRESO', 'RESUELTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "PrioridadTicketSoporte" AS ENUM ('BAJA', 'NORMAL', 'ALTA', 'URGENTE');

-- CreateTable
CREATE TABLE "tickets_soporte" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "estado" "EstadoTicketSoporte" NOT NULL DEFAULT 'ABIERTO',
    "prioridad" "PrioridadTicketSoporte" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_soporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensajes_ticket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "esSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "cuerpo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tickets_soporte_tenantId_estado_idx" ON "tickets_soporte"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "mensajes_ticket_tenantId_ticketId_idx" ON "mensajes_ticket"("tenantId", "ticketId");

-- AddForeignKey
ALTER TABLE "tickets_soporte" ADD CONSTRAINT "tickets_soporte_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets_soporte" ADD CONSTRAINT "tickets_soporte_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes_ticket" ADD CONSTRAINT "mensajes_ticket_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets_soporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes_ticket" ADD CONSTRAINT "mensajes_ticket_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mismo patrón de aislamiento multi-tenant que el resto de las tablas de
-- negocio. El superadmin de la plataforma responde/lista tickets de
-- cualquier tenant con bypassRls (igual que hace hoy con Tenant/Usuario).
ALTER TABLE "tickets_soporte" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tickets_soporte" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tickets_soporte"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE "mensajes_ticket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mensajes_ticket" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "mensajes_ticket"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- app_user ya tiene GRANT por ALTER DEFAULT PRIVILEGES (migración
-- app_role_least_privilege), pero esa cláusula sólo alcanza a tablas creadas
-- por el mismo rol que la definió. La dejamos explícita acá para no depender
-- de qué rol ejecute cada migración en cada entorno.
GRANT SELECT, INSERT, UPDATE, DELETE ON "tickets_soporte" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "mensajes_ticket" TO app_user;

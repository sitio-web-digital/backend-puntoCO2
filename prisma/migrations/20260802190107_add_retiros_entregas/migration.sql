-- CreateEnum
CREATE TYPE "EstadoRetiroEntrega" AS ENUM ('RETIRADO', 'EN_TRASLADO', 'EN_TALLER', 'ENTREGADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "retiros_entregas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matafuegoId" TEXT NOT NULL,
    "ordenTrabajoId" TEXT,
    "tecnicoResponsableId" TEXT,
    "personaQueEntrega" TEXT,
    "personaQueRetira" TEXT,
    "vehiculo" TEXT,
    "destino" TEXT,
    "estadoUnidadRetiro" TEXT,
    "fechaHoraRetiro" TIMESTAMP(3),
    "fechaHoraIngresoTaller" TIMESTAMP(3),
    "ubicacionInterna" TEXT,
    "fechaSalida" TIMESTAMP(3),
    "personaQueRecibe" TEXT,
    "firmaRecepcionNombre" TEXT,
    "observaciones" TEXT,
    "motivoCancelacion" TEXT,
    "estado" "EstadoRetiroEntrega" NOT NULL DEFAULT 'RETIRADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retiros_entregas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "retiros_entregas_tenantId_matafuegoId_idx" ON "retiros_entregas"("tenantId", "matafuegoId");

-- CreateIndex
CREATE INDEX "retiros_entregas_tenantId_estado_idx" ON "retiros_entregas"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "retiros_entregas_tenantId_tecnicoResponsableId_idx" ON "retiros_entregas"("tenantId", "tecnicoResponsableId");

-- AddForeignKey
ALTER TABLE "retiros_entregas" ADD CONSTRAINT "retiros_entregas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiros_entregas" ADD CONSTRAINT "retiros_entregas_matafuegoId_fkey" FOREIGN KEY ("matafuegoId") REFERENCES "matafuegos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiros_entregas" ADD CONSTRAINT "retiros_entregas_ordenTrabajoId_fkey" FOREIGN KEY ("ordenTrabajoId") REFERENCES "ordenes_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mismo patrón de aislamiento multi-tenant que el resto de las tablas de negocio.
ALTER TABLE "retiros_entregas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "retiros_entregas" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "retiros_entregas"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "retiros_entregas" TO app_user;

-- CreateEnum
CREATE TYPE "EstadoSector" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'DADO_DE_BAJA');

-- CreateEnum
CREATE TYPE "EstadoUbicacion" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'DADO_DE_BAJA');

-- CreateTable
CREATE TABLE "sectores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "establecimientoId" TEXT NOT NULL,
    "parentSectorId" TEXT,
    "nombre" TEXT NOT NULL,
    "responsable" TEXT,
    "observaciones" TEXT,
    "estado" "EstadoSector" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sectores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubicaciones" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "EstadoUbicacion" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ubicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sectores_tenantId_establecimientoId_idx" ON "sectores"("tenantId", "establecimientoId");

-- CreateIndex
CREATE INDEX "sectores_tenantId_parentSectorId_idx" ON "sectores"("tenantId", "parentSectorId");

-- CreateIndex
CREATE INDEX "ubicaciones_tenantId_sectorId_idx" ON "ubicaciones"("tenantId", "sectorId");

-- AddForeignKey
ALTER TABLE "sectores" ADD CONSTRAINT "sectores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sectores" ADD CONSTRAINT "sectores_establecimientoId_fkey" FOREIGN KEY ("establecimientoId") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sectores" ADD CONSTRAINT "sectores_parentSectorId_fkey" FOREIGN KEY ("parentSectorId") REFERENCES "sectores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicaciones" ADD CONSTRAINT "ubicaciones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicaciones" ADD CONSTRAINT "ubicaciones_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mismo patrón de aislamiento multi-tenant que el resto de las tablas de negocio.
ALTER TABLE "sectores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sectores" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sectores"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "sectores" TO app_user;

ALTER TABLE "ubicaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ubicaciones" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ubicaciones"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "ubicaciones" TO app_user;

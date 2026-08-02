-- CreateEnum
CREATE TYPE "SeveridadNoConformidad" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "NivelRiesgoNoConformidad" AS ENUM ('BAJO', 'MEDIO', 'ALTO', 'CRITICO');

-- CreateEnum
CREATE TYPE "EstadoNoConformidad" AS ENUM ('ABIERTA', 'ASIGNADA', 'EN_TRATAMIENTO', 'RESUELTA', 'VERIFICADA', 'CERRADA', 'DESCARTADA');

-- CreateTable
CREATE TABLE "no_conformidades" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matafuegoId" TEXT NOT NULL,
    "inspeccionId" TEXT,
    "detectadaPorId" TEXT NOT NULL,
    "tipoDefecto" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "severidad" "SeveridadNoConformidad" NOT NULL,
    "nivelRiesgo" "NivelRiesgoNoConformidad" NOT NULL,
    "accionInmediata" TEXT,
    "responsableId" TEXT,
    "fechaLimite" TIMESTAMP(3),
    "resolucion" TEXT,
    "reinspeccionRequerida" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoNoConformidad" NOT NULL DEFAULT 'ABIERTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "no_conformidades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "no_conformidades_tenantId_matafuegoId_idx" ON "no_conformidades"("tenantId", "matafuegoId");

-- CreateIndex
CREATE INDEX "no_conformidades_tenantId_estado_idx" ON "no_conformidades"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "no_conformidades_tenantId_responsableId_idx" ON "no_conformidades"("tenantId", "responsableId");

-- AddForeignKey
ALTER TABLE "no_conformidades" ADD CONSTRAINT "no_conformidades_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_conformidades" ADD CONSTRAINT "no_conformidades_matafuegoId_fkey" FOREIGN KEY ("matafuegoId") REFERENCES "matafuegos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_conformidades" ADD CONSTRAINT "no_conformidades_inspeccionId_fkey" FOREIGN KEY ("inspeccionId") REFERENCES "inspecciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mismo patrón de aislamiento multi-tenant que el resto de las tablas de negocio.
ALTER TABLE "no_conformidades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "no_conformidades" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "no_conformidades"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "no_conformidades" TO app_user;

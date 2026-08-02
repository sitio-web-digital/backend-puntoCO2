-- CreateEnum
CREATE TYPE "ResultadoInspeccion" AS ENUM ('APTO', 'APTO_CON_OBSERVACIONES', 'REQUIERE_MANTENIMIENTO', 'REQUIERE_RECARGA', 'REQUIERE_REEMPLAZO', 'NO_ENCONTRADO', 'ACCESO_IMPOSIBLE');

-- CreateEnum
CREATE TYPE "EstadoSincronizacion" AS ENUM ('SINCRONIZADO', 'PENDIENTE');

-- CreateTable
CREATE TABLE "inspecciones" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matafuegoId" TEXT NOT NULL,
    "establecimientoId" TEXT NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ubicacionRegistradaId" TEXT,
    "ubicacionDetectadaId" TEXT,
    "resultado" "ResultadoInspeccion" NOT NULL,
    "comentarios" TEXT,
    "firmaResponsableNombre" TEXT,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "dispositivo" TEXT,
    "estadoSincronizacion" "EstadoSincronizacion" NOT NULL DEFAULT 'SINCRONIZADO',
    "equipoPresente" BOOLEAN,
    "accesoLibre" BOOLEAN,
    "senalizacionVisible" BOOLEAN,
    "soporteFirme" BOOLEAN,
    "ausenciaDanios" BOOLEAN,
    "ausenciaCorrosion" BOOLEAN,
    "mangueraEnBuenEstado" BOOLEAN,
    "boquillaSinObstrucciones" BOOLEAN,
    "precintoIntacto" BOOLEAN,
    "pasadorSeguridadColocado" BOOLEAN,
    "manometroDentroDeRango" BOOLEAN,
    "pesoDentroDeTolerancia" BOOLEAN,
    "etiquetaLegible" BOOLEAN,
    "fechaVigente" BOOLEAN,
    "sinIndiciosDeDescarga" BOOLEAN,
    "ubicacionCorrecta" BOOLEAN,
    "fotografiaGeneral" BOOLEAN,
    "fotografiaEtiqueta" BOOLEAN,
    "fotografiaManometro" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspecciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inspecciones_tenantId_matafuegoId_idx" ON "inspecciones"("tenantId", "matafuegoId");

-- CreateIndex
CREATE INDEX "inspecciones_tenantId_establecimientoId_idx" ON "inspecciones"("tenantId", "establecimientoId");

-- CreateIndex
CREATE INDEX "inspecciones_tenantId_tecnicoId_idx" ON "inspecciones"("tenantId", "tecnicoId");

-- AddForeignKey
ALTER TABLE "inspecciones" ADD CONSTRAINT "inspecciones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecciones" ADD CONSTRAINT "inspecciones_matafuegoId_fkey" FOREIGN KEY ("matafuegoId") REFERENCES "matafuegos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecciones" ADD CONSTRAINT "inspecciones_establecimientoId_fkey" FOREIGN KEY ("establecimientoId") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecciones" ADD CONSTRAINT "inspecciones_ubicacionRegistradaId_fkey" FOREIGN KEY ("ubicacionRegistradaId") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecciones" ADD CONSTRAINT "inspecciones_ubicacionDetectadaId_fkey" FOREIGN KEY ("ubicacionDetectadaId") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mismo patrón de aislamiento multi-tenant que el resto de las tablas de negocio.
ALTER TABLE "inspecciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inspecciones" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inspecciones"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "inspecciones" TO app_user;

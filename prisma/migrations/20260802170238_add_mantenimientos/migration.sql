-- CreateEnum
CREATE TYPE "TipoServicioMantenimiento" AS ENUM ('INSPECCION', 'MANTENIMIENTO', 'RECARGA', 'PRUEBA_HIDRAULICA', 'CAMBIO_AGENTE', 'REPARACION', 'RETIRO_ENTREGA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoReglaMantenimiento" AS ENUM ('ACTIVA', 'INACTIVA');

-- CreateEnum
CREATE TYPE "PrioridadMantenimiento" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "EstadoMantenimientoProgramado" AS ENUM ('PROGRAMADO', 'REPROGRAMADO', 'REALIZADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "reglas_mantenimiento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT,
    "tipoServicio" "TipoServicioMantenimiento" NOT NULL,
    "tipoMatafuego" "TipoMatafuego",
    "agenteExtintor" "AgenteExtintor",
    "frecuenciaMeses" INTEGER NOT NULL,
    "normaTecnica" TEXT,
    "jurisdiccion" TEXT,
    "descripcion" TEXT,
    "estado" "EstadoReglaMantenimiento" NOT NULL DEFAULT 'ACTIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reglas_mantenimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mantenimientos_programados" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matafuegoId" TEXT NOT NULL,
    "establecimientoId" TEXT NOT NULL,
    "tipoServicio" "TipoServicioMantenimiento" NOT NULL,
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "reglaAplicadaId" TEXT,
    "tecnicoAsignadoId" TEXT,
    "prioridad" "PrioridadMantenimiento" NOT NULL DEFAULT 'MEDIA',
    "motivo" TEXT,
    "observaciones" TEXT,
    "cargadoRetroactivamente" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoMantenimientoProgramado" NOT NULL DEFAULT 'PROGRAMADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mantenimientos_programados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reglas_mantenimiento_tenantId_tipoServicio_estado_idx" ON "reglas_mantenimiento"("tenantId", "tipoServicio", "estado");

-- CreateIndex
CREATE INDEX "mantenimientos_programados_tenantId_matafuegoId_idx" ON "mantenimientos_programados"("tenantId", "matafuegoId");

-- CreateIndex
CREATE INDEX "mantenimientos_programados_tenantId_fechaProgramada_idx" ON "mantenimientos_programados"("tenantId", "fechaProgramada");

-- CreateIndex
CREATE INDEX "mantenimientos_programados_tenantId_estado_idx" ON "mantenimientos_programados"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "mantenimientos_programados_tenantId_tecnicoAsignadoId_idx" ON "mantenimientos_programados"("tenantId", "tecnicoAsignadoId");

-- AddForeignKey
ALTER TABLE "reglas_mantenimiento" ADD CONSTRAINT "reglas_mantenimiento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_mantenimiento" ADD CONSTRAINT "reglas_mantenimiento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos_programados" ADD CONSTRAINT "mantenimientos_programados_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos_programados" ADD CONSTRAINT "mantenimientos_programados_matafuegoId_fkey" FOREIGN KEY ("matafuegoId") REFERENCES "matafuegos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos_programados" ADD CONSTRAINT "mantenimientos_programados_establecimientoId_fkey" FOREIGN KEY ("establecimientoId") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos_programados" ADD CONSTRAINT "mantenimientos_programados_reglaAplicadaId_fkey" FOREIGN KEY ("reglaAplicadaId") REFERENCES "reglas_mantenimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mismo patrón de aislamiento multi-tenant que el resto de las tablas de negocio.
ALTER TABLE "reglas_mantenimiento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reglas_mantenimiento" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reglas_mantenimiento"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "reglas_mantenimiento" TO app_user;

ALTER TABLE "mantenimientos_programados" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mantenimientos_programados" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "mantenimientos_programados"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "mantenimientos_programados" TO app_user;

-- CreateEnum
CREATE TYPE "OrigenOrdenTrabajo" AS ENUM ('MANUAL', 'INSPECCION', 'VENCIMIENTO', 'PRESUPUESTO', 'NO_CONFORMIDAD', 'SOLICITUD_CLIENTE', 'MANTENIMIENTO_PROGRAMADO');

-- CreateEnum
CREATE TYPE "PrioridadOrdenTrabajo" AS ENUM ('BAJA', 'NORMAL', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "EstadoOrdenTrabajo" AS ENUM ('BORRADOR', 'PENDIENTE_DE_APROBACION', 'PROGRAMADA', 'ASIGNADA', 'EN_CAMINO', 'EN_PROCESO', 'PAUSADA', 'FINALIZADA', 'ENTREGADA', 'CANCELADA', 'FACTURADA');

-- CreateTable
CREATE TABLE "ordenes_trabajo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "clienteId" TEXT NOT NULL,
    "establecimientoId" TEXT,
    "origen" "OrigenOrdenTrabajo" NOT NULL DEFAULT 'MANUAL',
    "inspeccionOrigenId" TEXT,
    "noConformidadOrigenId" TEXT,
    "mantenimientoOrigenId" TEXT,
    "estado" "EstadoOrdenTrabajo" NOT NULL DEFAULT 'BORRADOR',
    "prioridad" "PrioridadOrdenTrabajo" NOT NULL DEFAULT 'NORMAL',
    "tecnicoAsignadoId" TEXT,
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaProgramada" TIMESTAMP(3),
    "fechaInicio" TIMESTAMP(3),
    "fechaFinalizacion" TIMESTAMP(3),
    "horasTrabajadas" DECIMAL(6,2),
    "repuestosUtilizados" TEXT,
    "resultadoTecnico" TEXT,
    "observaciones" TEXT,
    "motivoCancelacion" TEXT,
    "confirmacionClienteRecibida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordenes_trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_trabajo_unidades" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "matafuegoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordenes_trabajo_unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_trabajo_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "matafuegoId" TEXT,
    "descripcion" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "precioUnitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordenes_trabajo_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ordenes_trabajo_tenantId_estado_idx" ON "ordenes_trabajo"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_tenantId_clienteId_idx" ON "ordenes_trabajo"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_tenantId_tecnicoAsignadoId_idx" ON "ordenes_trabajo"("tenantId", "tecnicoAsignadoId");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_trabajo_tenantId_numero_key" ON "ordenes_trabajo"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_unidades_tenantId_matafuegoId_idx" ON "ordenes_trabajo_unidades"("tenantId", "matafuegoId");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_trabajo_unidades_ordenId_matafuegoId_key" ON "ordenes_trabajo_unidades"("ordenId", "matafuegoId");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_items_tenantId_ordenId_idx" ON "ordenes_trabajo_items"("tenantId", "ordenId");

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_establecimientoId_fkey" FOREIGN KEY ("establecimientoId") REFERENCES "establecimientos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_inspeccionOrigenId_fkey" FOREIGN KEY ("inspeccionOrigenId") REFERENCES "inspecciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_noConformidadOrigenId_fkey" FOREIGN KEY ("noConformidadOrigenId") REFERENCES "no_conformidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_mantenimientoOrigenId_fkey" FOREIGN KEY ("mantenimientoOrigenId") REFERENCES "mantenimientos_programados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo_unidades" ADD CONSTRAINT "ordenes_trabajo_unidades_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo_unidades" ADD CONSTRAINT "ordenes_trabajo_unidades_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo_unidades" ADD CONSTRAINT "ordenes_trabajo_unidades_matafuegoId_fkey" FOREIGN KEY ("matafuegoId") REFERENCES "matafuegos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo_items" ADD CONSTRAINT "ordenes_trabajo_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo_items" ADD CONSTRAINT "ordenes_trabajo_items_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo_items" ADD CONSTRAINT "ordenes_trabajo_items_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo_items" ADD CONSTRAINT "ordenes_trabajo_items_matafuegoId_fkey" FOREIGN KEY ("matafuegoId") REFERENCES "matafuegos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mismo patrón de aislamiento multi-tenant que el resto de las tablas de negocio.
ALTER TABLE "ordenes_trabajo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ordenes_trabajo" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ordenes_trabajo"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "ordenes_trabajo" TO app_user;

ALTER TABLE "ordenes_trabajo_unidades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ordenes_trabajo_unidades" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ordenes_trabajo_unidades"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "ordenes_trabajo_unidades" TO app_user;

ALTER TABLE "ordenes_trabajo_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ordenes_trabajo_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ordenes_trabajo_items"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "ordenes_trabajo_items" TO app_user;

-- CreateEnum
CREATE TYPE "TipoCertificado" AS ENUM ('CERTIFICADO_MANTENIMIENTO', 'CERTIFICADO_RECARGA', 'INFORME_INSPECCION', 'ACTA_RETIRO', 'ACTA_ENTREGA', 'INFORME_PRUEBA_HIDRAULICA', 'CONSTANCIA_NO_CONFORMIDAD', 'PLANILLA_DOTACION', 'HISTORIAL_TECNICO', 'CERTIFICADO_BAJA');

-- CreateEnum
CREATE TYPE "EstadoCertificado" AS ENUM ('BORRADOR', 'EMITIDO', 'VIGENTE', 'ANULADO', 'REEMPLAZADO');

-- CreateTable
CREATE TABLE "certificados" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "clienteId" TEXT NOT NULL,
    "establecimientoId" TEXT,
    "ordenTrabajoId" TEXT NOT NULL,
    "tipo" "TipoCertificado" NOT NULL,
    "serviciosRealizados" TEXT[],
    "responsableTecnicoId" TEXT,
    "responsableTecnicoNombre" TEXT,
    "firmaResponsableNombre" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenciaHasta" TIMESTAMP(3),
    "qrToken" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reemplazaAId" TEXT,
    "motivoAnulacion" TEXT,
    "motivoReemplazo" TEXT,
    "observaciones" TEXT,
    "estado" "EstadoCertificado" NOT NULL DEFAULT 'EMITIDO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificados_unidades" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "certificadoId" TEXT NOT NULL,
    "matafuegoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificados_unidades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificados_qrToken_key" ON "certificados"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_reemplazaAId_key" ON "certificados"("reemplazaAId");

-- CreateIndex
CREATE INDEX "certificados_tenantId_estado_idx" ON "certificados"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "certificados_tenantId_clienteId_idx" ON "certificados"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "certificados_tenantId_ordenTrabajoId_idx" ON "certificados"("tenantId", "ordenTrabajoId");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_tenantId_numero_key" ON "certificados"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "certificados_unidades_tenantId_matafuegoId_idx" ON "certificados_unidades"("tenantId", "matafuegoId");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_unidades_certificadoId_matafuegoId_key" ON "certificados_unidades"("certificadoId", "matafuegoId");

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_establecimientoId_fkey" FOREIGN KEY ("establecimientoId") REFERENCES "establecimientos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_ordenTrabajoId_fkey" FOREIGN KEY ("ordenTrabajoId") REFERENCES "ordenes_trabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_reemplazaAId_fkey" FOREIGN KEY ("reemplazaAId") REFERENCES "certificados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados_unidades" ADD CONSTRAINT "certificados_unidades_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados_unidades" ADD CONSTRAINT "certificados_unidades_certificadoId_fkey" FOREIGN KEY ("certificadoId") REFERENCES "certificados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados_unidades" ADD CONSTRAINT "certificados_unidades_matafuegoId_fkey" FOREIGN KEY ("matafuegoId") REFERENCES "matafuegos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mismo patrón de aislamiento multi-tenant que el resto de las tablas de negocio.
ALTER TABLE "certificados" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "certificados" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "certificados"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "certificados" TO app_user;

ALTER TABLE "certificados_unidades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "certificados_unidades" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "certificados_unidades"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "certificados_unidades" TO app_user;

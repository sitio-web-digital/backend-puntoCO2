-- CreateEnum
CREATE TYPE "EventoNotificacion" AS ENUM ('VENCIMIENTO_PROXIMO', 'MATAFUEGO_VENCIDO', 'MANTENIMIENTO_PROXIMO', 'MANTENIMIENTO_ATRASADO', 'PRUEBA_HIDRAULICA_PROXIMA', 'PRESUPUESTO_ENVIADO', 'PRESUPUESTO_PENDIENTE', 'ORDEN_PROGRAMADA', 'TECNICO_DEMORADO', 'UNIDAD_RETIRADA', 'UNIDAD_LISTA_PARA_ENTREGA', 'REEMPLAZO_TEMPORAL_ATRASADO', 'CERTIFICADO_EMITIDO', 'FACTURA_EMITIDA', 'FACTURA_VENCIDA', 'STOCK_MINIMO', 'ERROR_INTEGRACION');

-- CreateEnum
CREATE TYPE "EstadoNotificacion" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'ENVIADA', 'ENTREGADA', 'LEIDA', 'FALLIDA', 'REINTENTO', 'CANCELADA');

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evento" "EventoNotificacion" NOT NULL,
    "canal" "CanalNotificacion" NOT NULL,
    "canalAlternativo" "CanalNotificacion",
    "destinatarioNombre" TEXT,
    "destinatarioEmail" TEXT,
    "destinatarioWhatsapp" TEXT,
    "clienteId" TEXT,
    "usuarioId" TEXT,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "plantilla" TEXT NOT NULL,
    "payload" JSONB,
    "claveDedup" TEXT NOT NULL,
    "estado" "EstadoNotificacion" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "maxIntentos" INTEGER NOT NULL DEFAULT 3,
    "programadaPara" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadaEn" TIMESTAMP(3),
    "entregadaEn" TIMESTAMP(3),
    "leidaEn" TIMESTAMP(3),
    "errorDetalle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificaciones_tenantId_estado_idx" ON "notificaciones"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "notificaciones_tenantId_evento_idx" ON "notificaciones"("tenantId", "evento");

-- CreateIndex
CREATE INDEX "notificaciones_tenantId_usuarioId_idx" ON "notificaciones"("tenantId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "notificaciones_tenantId_claveDedup_key" ON "notificaciones"("tenantId", "claveDedup");

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mismo patrón de aislamiento multi-tenant que el resto de las tablas de negocio.
ALTER TABLE "notificaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notificaciones" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notificaciones"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "notificaciones" TO app_user;

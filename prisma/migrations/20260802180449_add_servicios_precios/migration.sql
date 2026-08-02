-- CreateEnum
CREATE TYPE "CategoriaServicio" AS ENUM ('RECARGA', 'PRUEBA_HIDRAULICA', 'PINTURA', 'REPARACION', 'CAMBIO_AGENTE', 'INSPECCION', 'MANTENIMIENTO', 'REEMPLAZO_REPUESTOS', 'VENTA', 'INSTALACION', 'RETIRO_ENTREGA', 'OTRO');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "EstadoServicio" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoListaPrecio" AS ENUM ('ACTIVA', 'INACTIVA');

-- CreateTable
CREATE TABLE "servicios" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaServicio" NOT NULL,
    "descripcion" TEXT,
    "precioBase" DECIMAL(12,2) NOT NULL,
    "costoEstimado" DECIMAL(12,2),
    "iva" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "duracionEstimadaMinutos" INTEGER,
    "agentesCompatibles" "AgenteExtintor"[],
    "capacidadesCompatibles" TEXT[],
    "requiereRetiro" BOOLEAN NOT NULL DEFAULT false,
    "requiereEnsayo" BOOLEAN NOT NULL DEFAULT false,
    "requiereRepuestos" BOOLEAN NOT NULL DEFAULT false,
    "requiereCertificado" BOOLEAN NOT NULL DEFAULT false,
    "vigenteDesde" TIMESTAMP(3),
    "vigenteHasta" TIMESTAMP(3),
    "estado" "EstadoServicio" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listas_precio" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "esPredeterminada" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoListaPrecio" NOT NULL DEFAULT 'ACTIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listas_precio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precios_servicio" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "listaPrecioId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenteHasta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "precios_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "servicios_tenantId_estado_idx" ON "servicios"("tenantId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "servicios_tenantId_codigo_key" ON "servicios"("tenantId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "listas_precio_tenantId_nombre_key" ON "listas_precio"("tenantId", "nombre");

-- CreateIndex
CREATE INDEX "precios_servicio_tenantId_listaPrecioId_servicioId_vigenteH_idx" ON "precios_servicio"("tenantId", "listaPrecioId", "servicioId", "vigenteHasta");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_listaPrecioId_fkey" FOREIGN KEY ("listaPrecioId") REFERENCES "listas_precio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listas_precio" ADD CONSTRAINT "listas_precio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_servicio" ADD CONSTRAINT "precios_servicio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_servicio" ADD CONSTRAINT "precios_servicio_listaPrecioId_fkey" FOREIGN KEY ("listaPrecioId") REFERENCES "listas_precio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_servicio" ADD CONSTRAINT "precios_servicio_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mismo patrón de aislamiento multi-tenant que el resto de las tablas de negocio.
ALTER TABLE "servicios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "servicios" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "servicios"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "servicios" TO app_user;

ALTER TABLE "listas_precio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "listas_precio" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "listas_precio"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "listas_precio" TO app_user;

ALTER TABLE "precios_servicio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "precios_servicio" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "precios_servicio"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "precios_servicio" TO app_user;

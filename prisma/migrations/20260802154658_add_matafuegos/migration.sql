-- CreateEnum
CREATE TYPE "TipoMatafuego" AS ENUM ('PORTATIL', 'RODANTE', 'VEHICULAR', 'OTRO');

-- CreateEnum
CREATE TYPE "AgenteExtintor" AS ENUM ('POLVO_QUIMICO_ABC', 'CO2', 'AGUA', 'ESPUMA', 'AGENTE_LIMPIO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoMatafuego" AS ENUM ('INSTALADO', 'PENDIENTE_DE_CONTROL', 'APTO', 'OBSERVADO', 'VENCIDO', 'RETIRADO', 'EN_TRASLADO', 'EN_TALLER', 'EN_RECARGA', 'EN_PRUEBA_HIDRAULICA', 'RECHAZADO', 'FUERA_DE_SERVICIO', 'ENTREGADO', 'DADO_DE_BAJA', 'EXTRAVIADO');

-- CreateTable
CREATE TABLE "matafuegos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigoInterno" TEXT NOT NULL,
    "numeroSerie" TEXT NOT NULL,
    "codigoBarras" TEXT,
    "clienteId" TEXT NOT NULL,
    "establecimientoId" TEXT NOT NULL,
    "sectorId" TEXT,
    "ubicacionId" TEXT,
    "tipo" "TipoMatafuego" NOT NULL,
    "agenteExtintor" "AgenteExtintor" NOT NULL,
    "capacidadNominal" TEXT,
    "marca" TEXT,
    "modelo" TEXT,
    "fabricante" TEXT,
    "fechaFabricacion" TIMESTAMP(3),
    "fechaPuestaServicio" TIMESTAMP(3),
    "fechaUltimaInspeccion" TIMESTAMP(3),
    "fechaUltimoControl" TIMESTAMP(3),
    "fechaUltimoMantenimiento" TIMESTAMP(3),
    "fechaUltimaRecarga" TIMESTAMP(3),
    "fechaUltimaPruebaHidraulica" TIMESTAMP(3),
    "proximaInspeccion" TIMESTAMP(3),
    "proximoMantenimiento" TIMESTAMP(3),
    "proximaRecarga" TIMESTAMP(3),
    "proximaPruebaHidraulica" TIMESTAMP(3),
    "pesoNominal" DOUBLE PRECISION,
    "pesoVerificado" DOUBLE PRECISION,
    "estadoManometro" TEXT,
    "estadoMangueraBoquilla" TEXT,
    "estadoPrecinto" TEXT,
    "estadoSoporteGabinete" TEXT,
    "normaTecnica" TEXT,
    "observaciones" TEXT,
    "estado" "EstadoMatafuego" NOT NULL DEFAULT 'PENDIENTE_DE_CONTROL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matafuegos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_matafuego" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matafuegoId" TEXT NOT NULL,
    "sectorOrigenId" TEXT,
    "ubicacionOrigenId" TEXT,
    "sectorDestinoId" TEXT,
    "ubicacionDestinoId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_matafuego_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "matafuegos_tenantId_estado_idx" ON "matafuegos"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "matafuegos_tenantId_clienteId_idx" ON "matafuegos"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "matafuegos_tenantId_establecimientoId_idx" ON "matafuegos"("tenantId", "establecimientoId");

-- CreateIndex
CREATE INDEX "matafuegos_tenantId_ubicacionId_idx" ON "matafuegos"("tenantId", "ubicacionId");

-- CreateIndex
CREATE UNIQUE INDEX "matafuegos_tenantId_numeroSerie_key" ON "matafuegos"("tenantId", "numeroSerie");

-- CreateIndex
CREATE UNIQUE INDEX "matafuegos_tenantId_codigoInterno_key" ON "matafuegos"("tenantId", "codigoInterno");

-- CreateIndex
CREATE INDEX "movimientos_matafuego_tenantId_matafuegoId_idx" ON "movimientos_matafuego"("tenantId", "matafuegoId");

-- AddForeignKey
ALTER TABLE "matafuegos" ADD CONSTRAINT "matafuegos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matafuegos" ADD CONSTRAINT "matafuegos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matafuegos" ADD CONSTRAINT "matafuegos_establecimientoId_fkey" FOREIGN KEY ("establecimientoId") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matafuegos" ADD CONSTRAINT "matafuegos_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matafuegos" ADD CONSTRAINT "matafuegos_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_matafuego" ADD CONSTRAINT "movimientos_matafuego_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_matafuego" ADD CONSTRAINT "movimientos_matafuego_matafuegoId_fkey" FOREIGN KEY ("matafuegoId") REFERENCES "matafuegos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mismo patrón de aislamiento multi-tenant que el resto de las tablas de negocio.
ALTER TABLE "matafuegos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "matafuegos" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "matafuegos"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "matafuegos" TO app_user;

ALTER TABLE "movimientos_matafuego" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "movimientos_matafuego" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "movimientos_matafuego"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "movimientos_matafuego" TO app_user;

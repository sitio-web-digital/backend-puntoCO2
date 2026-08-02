-- CreateEnum
CREATE TYPE "EstadoEstablecimiento" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'DADO_DE_BAJA');

-- CreateTable
CREATE TABLE "establecimientos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "provincia" TEXT,
    "localidad" TEXT,
    "codigoPostal" TEXT,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "responsableSeguridad" TEXT,
    "contactoOperativo" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "horariosAtencion" TEXT,
    "indicacionesAcceso" TEXT,
    "normativaAplicable" TEXT,
    "observaciones" TEXT,
    "estado" "EstadoEstablecimiento" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "establecimientos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "establecimientos_tenantId_clienteId_idx" ON "establecimientos"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "establecimientos_tenantId_estado_idx" ON "establecimientos"("tenantId", "estado");

-- AddForeignKey
ALTER TABLE "establecimientos" ADD CONSTRAINT "establecimientos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "establecimientos" ADD CONSTRAINT "establecimientos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mismo patrón de aislamiento multi-tenant que el resto de las tablas de negocio.
ALTER TABLE "establecimientos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "establecimientos" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "establecimientos"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- app_user ya tiene GRANT por ALTER DEFAULT PRIVILEGES (migración
-- app_role_least_privilege), pero esa cláusula sólo alcanza a tablas creadas
-- por el mismo rol que la definió. La dejamos explícita acá para no depender
-- de qué rol ejecute cada migración en cada entorno.
GRANT SELECT, INSERT, UPDATE, DELETE ON "establecimientos" TO app_user;

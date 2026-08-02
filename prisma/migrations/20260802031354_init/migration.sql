-- CreateEnum
CREATE TYPE "EstadoTenant" AS ENUM ('TRIAL', 'ACTIVO', 'SUSPENDIDO', 'VENCIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'DADO_DE_BAJA');

-- CreateEnum
CREATE TYPE "RecursoPermiso" AS ENUM ('CLIENTES', 'ESTABLECIMIENTOS', 'MATAFUEGOS', 'INSPECCIONES', 'NO_CONFORMIDADES', 'MANTENIMIENTOS', 'SERVICIOS_PRECIOS', 'ORDENES_TRABAJO', 'RETIROS_ENTREGAS', 'CERTIFICADOS', 'NOTIFICACIONES', 'REPORTES', 'USUARIOS_ROLES', 'TENANT_ADMIN');

-- CreateEnum
CREATE TYPE "AccionPermiso" AS ENUM ('VER', 'CREAR', 'EDITAR', 'APROBAR', 'EMITIR', 'EXPORTAR', 'ELIMINAR');

-- CreateEnum
CREATE TYPE "AlcancePermiso" AS ENUM ('PROHIBIDO', 'PROPIO', 'ESTABLECIMIENTO_ASIGNADO', 'SUCURSAL_ACTUAL', 'TODAS');

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'LOGIN', 'LOGIN_FAILED', 'PERMISSION_DENIED');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('PERSONA_HUMANA', 'PERSONA_JURIDICA');

-- CreateEnum
CREATE TYPE "CondicionIVA" AS ENUM ('RESPONSABLE_INSCRIPTO', 'MONOTRIBUTISTA', 'EXENTO', 'CONSUMIDOR_FINAL', 'NO_RESPONSABLE');

-- CreateEnum
CREATE TYPE "TipoConsumidor" AS ENUM ('CONSUMIDOR_FINAL', 'EMPRESA', 'ORGANISMO_PUBLICO');

-- CreateEnum
CREATE TYPE "CanalNotificacion" AS ENUM ('EMAIL', 'WHATSAPP', 'TELEFONO');

-- CreateEnum
CREATE TYPE "EstadoCliente" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'DADO_DE_BAJA');

-- CreateEnum
CREATE TYPE "TipoContacto" AS ENUM ('ADMINISTRATIVO', 'TECNICO', 'FACTURACION');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cuit" TEXT,
    "estado" "EstadoTenant" NOT NULL DEFAULT 'TRIAL',
    "plan" TEXT NOT NULL DEFAULT 'trial',
    "limites" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "esSuperAdminSaas" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "esRolSistema" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_permisos" (
    "id" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,
    "recurso" "RecursoPermiso" NOT NULL,
    "accion" "AccionPermiso" NOT NULL,
    "alcance" "AlcancePermiso" NOT NULL,

    CONSTRAINT "rol_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_roles" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,

    CONSTRAINT "usuario_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "usuarioId" TEXT,
    "accion" "AccionAuditoria" NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "valorAnterior" JSONB,
    "valorNuevo" JSONB,
    "motivo" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipoCliente" "TipoCliente" NOT NULL,
    "nombre" TEXT,
    "apellido" TEXT,
    "razonSocial" TEXT,
    "nombreFantasia" TEXT,
    "cuit" TEXT,
    "condicionIva" "CondicionIVA" NOT NULL,
    "tipoConsumidor" "TipoConsumidor" NOT NULL,
    "email" TEXT,
    "whatsapp" TEXT,
    "telefonoAlternativo" TEXT,
    "domicilioFiscal" TEXT,
    "provincia" TEXT,
    "localidad" TEXT,
    "codigoPostal" TEXT,
    "canalPreferido" "CanalNotificacion" NOT NULL DEFAULT 'EMAIL',
    "condicionPago" TEXT,
    "listaPrecioId" TEXT,
    "observaciones" TEXT,
    "estado" "EstadoCliente" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contactos_cliente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipo" "TipoContacto" NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contactos_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "usuarios_tenantId_idx" ON "usuarios"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_tenantId_email_key" ON "usuarios"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_refreshTokenHash_key" ON "sesiones"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "sesiones_usuarioId_idx" ON "sesiones"("usuarioId");

-- CreateIndex
CREATE INDEX "roles_tenantId_idx" ON "roles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenantId_nombre_key" ON "roles"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "rol_permisos_rolId_recurso_accion_key" ON "rol_permisos"("rolId", "recurso", "accion");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_roles_usuarioId_rolId_key" ON "usuario_roles"("usuarioId", "rolId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_entidad_entidadId_idx" ON "audit_logs"("tenantId", "entidad", "entidadId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "clientes_tenantId_estado_idx" ON "clientes"("tenantId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_tenantId_cuit_key" ON "clientes"("tenantId", "cuit");

-- CreateIndex
CREATE INDEX "contactos_cliente_tenantId_clienteId_idx" ON "contactos_cliente"("tenantId", "clienteId");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_roles" ADD CONSTRAINT "usuario_roles_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_roles" ADD CONSTRAINT "usuario_roles_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos_cliente" ADD CONSTRAINT "contactos_cliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos_cliente" ADD CONSTRAINT "contactos_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Row-Level Security: segunda capa de aislamiento multi-tenant.
--
-- Cada request de la app abre su trabajo con `SET LOCAL app.tenant_id = '<id>'`
-- (ver src/server/db/with-tenant.ts). Estas políticas hacen que, aunque una
-- query de aplicación olvide filtrar por tenantId, Postgres igual la limite
-- al tenant activo. `FORCE ROW LEVEL SECURITY` asegura que la política se
-- aplique también al dueño de la tabla (en producción, usar además un rol de
-- aplicación sin privilegios de owner es la práctica recomendada).
--
-- `app.bypass_rls = 'on'` es la única forma de ver filas cross-tenant o filas
-- de plataforma (tenantId NULL); sólo debe setearse en rutas de código
-- explícitamente de superadmin SaaS, nunca por defecto.
-- ============================================================================

ALTER TABLE "clientes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clientes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "clientes"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "contactos_cliente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contactos_cliente" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "contactos_cliente"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuarios" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "usuarios"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR ("tenantId" IS NULL AND current_setting('app.bypass_rls', true) = 'on')
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR ("tenantId" IS NULL AND current_setting('app.bypass_rls', true) = 'on')
  );

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "roles"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR ("tenantId" IS NULL AND current_setting('app.bypass_rls', true) = 'on')
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR ("tenantId" IS NULL AND current_setting('app.bypass_rls', true) = 'on')
  );

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_logs"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- Las políticas de clientes/contactos_cliente habían quedado sin la cláusula
-- de app.bypass_rls que sí tienen usuarios/roles/audit_logs, dejando esas dos
-- tablas sin ninguna forma de acceso cross-tenant explícito (ni siquiera para
-- rutas de superadmin SaaS). Se corrige para que las cuatro políticas sigan
-- el mismo patrón.

ALTER POLICY tenant_isolation ON "clientes"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER POLICY tenant_isolation ON "contactos_cliente"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );

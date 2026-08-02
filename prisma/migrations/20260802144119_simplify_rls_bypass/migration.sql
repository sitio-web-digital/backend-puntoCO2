-- Las políticas de usuarios/roles/audit_logs restringían app.bypass_rls a sólo
-- exponer filas de plataforma (tenantId NULL), lo que impedía un caso legítimo:
-- el alta de tenant (RF-28) corre en modo bypass y necesita crear filas CON un
-- tenantId concreto (los roles y el usuario administrador del tenant recién
-- creado). Se simplifica al mismo patrón que ya usan clientes/contactos_cliente:
-- bypass_rls = 'on' habilita acceso cross-tenant completo, sin importar si la
-- fila tiene tenantId NULL o no. Sigue siendo una ruta que sólo debe activar
-- código de plataforma explícitamente auditado (RF-28), nunca lógica de negocio
-- de un tenant.

ALTER POLICY tenant_isolation ON "usuarios"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER POLICY tenant_isolation ON "roles"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    "tenantId" = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );

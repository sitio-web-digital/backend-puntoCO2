-- Simplifica el catálogo de roles de 9 a 3 (Administrador de empresa,
-- Técnico, Cliente externo) en todos los tenants existentes. El código ya
-- sólo siembra estos 3 en tenants nuevos (default-roles.ts); esta migración
-- pone al día a los tenants creados antes del cambio.
--
-- Reasigna a cada usuario afectado ANTES de borrar los roles viejos, para
-- no dejar a nadie sin acceso: los roles de campo/taller (Responsable
-- técnico, Técnico de campo, Operador de taller) van a un nuevo rol
-- "Técnico" por tenant (con la misma matriz de permisos que
-- DEFAULT_ROLE_TEMPLATES); los roles administrativos/comerciales
-- (Comercial, Facturación, Cobranza, Auditor) van a "Administrador de
-- empresa", que ya cubre esas funciones.
DO $$
DECLARE
  t RECORD;
  nuevo_rol_tecnico_id TEXT;
  rol_admin_id TEXT;
  rol_tecnico_existente_id TEXT;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    SELECT id INTO rol_admin_id FROM roles WHERE "tenantId" = t.id AND nombre = 'Administrador de empresa';
    SELECT id INTO rol_tecnico_existente_id FROM roles WHERE "tenantId" = t.id AND nombre = 'Técnico';

    IF rol_tecnico_existente_id IS NULL THEN
      nuevo_rol_tecnico_id := gen_random_uuid()::text;
      INSERT INTO roles (id, "tenantId", nombre, descripcion, "esRolSistema", "createdAt", "updatedAt")
      VALUES (
        nuevo_rol_tecnico_id,
        t.id,
        'Técnico',
        'Ejecuta inspecciones, mantenimientos, retiros/entregas y emite certificados sobre lo que tiene asignado.',
        true,
        now(),
        now()
      );

      INSERT INTO rol_permisos (id, "rolId", recurso, accion, alcance) VALUES
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'CLIENTES', 'VER', 'ESTABLECIMIENTO_ASIGNADO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'ESTABLECIMIENTOS', 'VER', 'ESTABLECIMIENTO_ASIGNADO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'MATAFUEGOS', 'VER', 'ESTABLECIMIENTO_ASIGNADO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'MATAFUEGOS', 'CREAR', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'MATAFUEGOS', 'EDITAR', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'INSPECCIONES', 'VER', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'INSPECCIONES', 'CREAR', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'INSPECCIONES', 'EDITAR', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'NO_CONFORMIDADES', 'VER', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'NO_CONFORMIDADES', 'CREAR', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'NO_CONFORMIDADES', 'EDITAR', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'MANTENIMIENTOS', 'VER', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'MANTENIMIENTOS', 'CREAR', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'MANTENIMIENTOS', 'EDITAR', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'SERVICIOS_PRECIOS', 'VER', 'TODAS'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'ORDENES_TRABAJO', 'VER', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'ORDENES_TRABAJO', 'CREAR', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'ORDENES_TRABAJO', 'EDITAR', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'RETIROS_ENTREGAS', 'VER', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'RETIROS_ENTREGAS', 'CREAR', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'RETIROS_ENTREGAS', 'EDITAR', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'CERTIFICADOS', 'VER', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'CERTIFICADOS', 'CREAR', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'CERTIFICADOS', 'EMITIR', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'NOTIFICACIONES', 'VER', 'PROPIO'),
        (gen_random_uuid()::text, nuevo_rol_tecnico_id, 'REPORTES', 'VER', 'PROPIO');
    ELSE
      nuevo_rol_tecnico_id := rol_tecnico_existente_id;
    END IF;

    -- Reasigna a "Técnico" a quien tuviera cualquiera de los 3 roles de
    -- campo/taller. ON CONFLICT DO NOTHING por si un usuario ya tenía más
    -- de uno de esos roles a la vez (no violar el unique de usuario_roles).
    INSERT INTO usuario_roles (id, "usuarioId", "rolId")
    SELECT gen_random_uuid()::text, ur."usuarioId", nuevo_rol_tecnico_id
    FROM usuario_roles ur
    JOIN roles r ON r.id = ur."rolId"
    WHERE r."tenantId" = t.id
      AND r.nombre IN ('Responsable técnico', 'Técnico de campo', 'Operador de taller')
    ON CONFLICT DO NOTHING;

    -- Reasigna a "Administrador de empresa" a quien tuviera un rol
    -- administrativo/comercial (esas funciones ya están cubiertas por el
    -- acceso total del administrador).
    IF rol_admin_id IS NOT NULL THEN
      INSERT INTO usuario_roles (id, "usuarioId", "rolId")
      SELECT gen_random_uuid()::text, ur."usuarioId", rol_admin_id
      FROM usuario_roles ur
      JOIN roles r ON r.id = ur."rolId"
      WHERE r."tenantId" = t.id
        AND r.nombre IN ('Comercial', 'Facturación', 'Cobranza', 'Auditor')
      ON CONFLICT DO NOTHING;
    END IF;

    -- Borra los 6 roles viejos de este tenant. El cascade de rol_permisos y
    -- usuario_roles es seguro acá: cualquier asignación ya se reasignó arriba.
    DELETE FROM roles
    WHERE "tenantId" = t.id
      AND nombre IN ('Responsable técnico', 'Técnico de campo', 'Operador de taller', 'Comercial', 'Facturación', 'Cobranza', 'Auditor');
  END LOOP;
END $$;

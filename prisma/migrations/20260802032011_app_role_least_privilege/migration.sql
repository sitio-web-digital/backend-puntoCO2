-- ============================================================================
-- Rol de aplicación de mínimo privilegio.
--
-- El usuario con el que se corren las migraciones (DATABASE_URL, dueño de las
-- tablas) NO debe ser el que usa la aplicación en runtime: en Postgres, RLS
-- nunca se aplica a superusuarios, y "FORCE ROW LEVEL SECURITY" tampoco los
-- alcanza. `app_user` es el rol que realmente usa el servidor Next.js
-- (RUNTIME_DATABASE_URL) para que las políticas de tenant_isolation definidas
-- en la migración `init` se apliquen de verdad.
--
-- La contraseña de este rol NO se fija acá (no se commitean secretos). Se
-- setea aparte con ALTER ROLE ... WITH PASSWORD, una vez por entorno:
-- local dev vía `npm run db:bootstrap`, producción vía el proceso de gestión
-- de secretos del proveedor gestionado (Neon/Supabase).
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Para que las tablas creadas por migraciones futuras también queden
-- accesibles a app_user sin tener que acordarse de agregarlo cada vez.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;

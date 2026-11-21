-- Ejecutar como propietario después de instalar/restaurar. No contiene claves.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bi_lector') THEN
   CREATE ROLE bi_lector NOLOGIN;
 END IF;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA public,bi,etl FROM bi_lector;
REVOKE ALL ON SCHEMA etl FROM bi_lector;
GRANT USAGE ON SCHEMA dw TO bi_lector;
GRANT SELECT ON ALL TABLES IN SCHEMA dw TO bi_lector;
ALTER DEFAULT PRIVILEGES IN SCHEMA dw GRANT SELECT ON TABLES TO bi_lector;
-- Crear/configurar el LOGIN del conector por el mecanismo seguro del administrador.
-- Después: GRANT bi_lector TO nombre_del_login;

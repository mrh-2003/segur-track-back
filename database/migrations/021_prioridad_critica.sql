-- Cuarta prioridad de incidencias. No modifica los plazos de casos existentes.
-- PostgreSQL exige recrear la vista que expone la columna al ampliar su longitud.
-- DROP sin CASCADE: cualquier dependencia adicional aborta sin eliminar objetos.
DO $$
DECLARE definicion TEXT; propietario TEXT; comentario TEXT; permisos JSONB; permiso RECORD;
BEGIN
 IF to_regclass('public.vw_bi_incidencias') IS NOT NULL THEN
  SELECT pg_get_viewdef(c.oid,true),pg_get_userbyid(c.relowner),obj_description(c.oid,'pg_class')
   INTO definicion,propietario,comentario FROM pg_class c WHERE c.oid='public.vw_bi_incidencias'::regclass;
  SELECT jsonb_agg(to_jsonb(g)) INTO permisos FROM information_schema.role_table_grants g
   WHERE table_schema='public' AND table_name='vw_bi_incidencias';
  DROP VIEW public.vw_bi_incidencias;
 END IF;
 ALTER TABLE incidencias ALTER COLUMN prioridad TYPE VARCHAR(7);
 IF definicion IS NOT NULL THEN
  EXECUTE 'CREATE VIEW public.vw_bi_incidencias AS '||definicion;
  EXECUTE format('ALTER VIEW public.vw_bi_incidencias OWNER TO %I',propietario);
  IF comentario IS NOT NULL THEN EXECUTE format('COMMENT ON VIEW public.vw_bi_incidencias IS %L',comentario); END IF;
  FOR permiso IN SELECT * FROM jsonb_to_recordset(COALESCE(permisos,'[]')) g(grantee TEXT,privilege_type TEXT,is_grantable TEXT) LOOP
   EXECUTE format('GRANT %s ON public.vw_bi_incidencias TO %s%s',permiso.privilege_type,
    CASE WHEN permiso.grantee='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(permiso.grantee) END,
    CASE WHEN permiso.is_grantable='YES' THEN ' WITH GRANT OPTION' ELSE '' END);
  END LOOP;
 END IF;
END $$;
ALTER TABLE incidencias DROP CONSTRAINT incidencias_prioridad_check;
ALTER TABLE incidencias ADD CONSTRAINT incidencias_prioridad_check
 CHECK(prioridad IN ('critica','alta','media','baja'));
ALTER TABLE configuracion_operativa
 ADD COLUMN sla_critica INT NOT NULL DEFAULT 15 CHECK(sla_critica>0),
 ADD COLUMN resolucion_critica INT NOT NULL DEFAULT 60 CHECK(resolucion_critica>0);
CREATE OR REPLACE FUNCTION completar_plazos_incidencia() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE cfg configuracion_operativa%ROWTYPE;
BEGIN
 SELECT * INTO cfg FROM configuracion_operativa WHERE id=1;
 IF NEW.sla_min IS NULL THEN
   NEW.sla_min := CASE NEW.prioridad WHEN 'critica' THEN cfg.sla_critica WHEN 'alta' THEN cfg.sla_alta WHEN 'media' THEN cfg.sla_media ELSE cfg.sla_baja END;
 END IF;
 IF NEW.sla_resolucion_min IS NULL THEN
   NEW.sla_resolucion_min := CASE NEW.prioridad WHEN 'critica' THEN cfg.resolucion_critica WHEN 'alta' THEN cfg.resolucion_alta WHEN 'media' THEN cfg.resolucion_media ELSE cfg.resolucion_baja END;
   NEW.origen_plazo := 'configuracion_vigente';
 END IF;
 RETURN NEW;
END $$;

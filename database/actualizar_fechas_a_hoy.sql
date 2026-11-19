-- Segur Track: trasladar el escenario de demostración al día de hoy (Lima).
-- Todas las fechas se desplazan la misma cantidad de días; las horas no cambian.
-- Revisión: 18/11/2026. La fecha destino se calcula en America/Lima.
-- Ejecutable en psql o en un editor SQL, conectado a la base del sistema.
-- Repetir el mismo día no vuelve a desplazar las fechas.
BEGIN;
SET LOCAL TIME ZONE 'America/Lima';
SET LOCAL lock_timeout = '15s';
SELECT pg_advisory_xact_lock(741095);

-- Solo existe durante esta conexión; no agrega funciones al esquema del sistema.
CREATE OR REPLACE FUNCTION pg_temp.desplazar_fechas_json(valor JSONB, dias INT)
RETURNS JSONB LANGUAGE plpgsql AS $func$
DECLARE texto TEXT; resultado JSONB;
BEGIN
  IF valor IS NULL OR dias=0 THEN RETURN valor; END IF;
  CASE jsonb_typeof(valor)
    WHEN 'object' THEN
      SELECT COALESCE(jsonb_object_agg(key,pg_temp.desplazar_fechas_json(value,dias)),'{}'::jsonb)
        INTO resultado FROM jsonb_each(valor);
      RETURN resultado;
    WHEN 'array' THEN
      SELECT COALESCE(jsonb_agg(pg_temp.desplazar_fechas_json(value,dias) ORDER BY orden),'[]'::jsonb)
        INTO resultado FROM jsonb_array_elements(valor) WITH ORDINALITY AS a(value,orden);
      RETURN resultado;
    WHEN 'string' THEN
      texto := valor #>> '{}';
      BEGIN
        IF texto ~ '^\d{4}-\d{2}-\d{2}$' THEN
          RETURN to_jsonb(to_char(texto::date+dias,'YYYY-MM-DD'));
        ELSIF texto ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)$' THEN
          RETURN to_jsonb(to_char((texto::timestamptz+make_interval(days=>dias)) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
        ELSIF texto ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$' THEN
          RETURN to_jsonb(to_char(texto::timestamp+make_interval(days=>dias),'YYYY-MM-DD"T"HH24:MI:SS.US'));
        ELSIF texto ~ '^\d{2}/\d{2}/\d{4}$' AND to_char(to_date(texto,'DD/MM/YYYY'),'DD/MM/YYYY')=texto THEN
          RETURN to_jsonb(to_char(to_date(texto,'DD/MM/YYYY')+dias,'DD/MM/YYYY'));
        END IF;
      EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
        RETURN valor;
      END;
      RETURN valor;
    ELSE RETURN valor;
  END CASE;
END;
$func$;

DO $trasladar$
DECLARE
  hoy DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date;
  base DATE;
  es_demo BOOLEAN;
  dias INT;
  t RECORD;
  cambios TEXT;
  lista TEXT;
  total_turnos BIGINT;
  duraciones NUMERIC;
BEGIN
  SELECT datos_demo,(demo_generada_en AT TIME ZONE 'America/Lima')::date
    INTO es_demo,base FROM public.configuracion_operativa WHERE id=1 FOR UPDATE;
  IF NOT COALESCE(es_demo,FALSE) OR base IS NULL THEN
    RAISE EXCEPTION 'Se requiere una base identificada como demo y con fecha base registrada';
  END IF;
  dias := hoy-base;
  IF dias=0 THEN
    RAISE NOTICE 'La fecha base ya es hoy (%). No se modificó ningún registro.',hoy;
    RETURN;
  END IF;
  IF dias<0 THEN
    RAISE EXCEPTION 'La fecha base (%) es posterior a hoy (%); no se retrocederá el escenario',base,hoy;
  END IF;

  SELECT string_agg(format('%I.%I',schemaname,tablename),', ' ORDER BY schemaname,tablename)
    INTO lista FROM pg_tables WHERE schemaname IN ('public','bi');
  EXECUTE 'LOCK TABLE '||lista||' IN ACCESS EXCLUSIVE MODE';

  -- Conservar el estado original de los disparadores. El traslado no representa
  -- nuevas marcaciones, revisiones ni incidencias y no duplica la auditoría.
  CREATE TEMP TABLE _traslado_disparadores ON COMMIT DROP AS
    SELECT n.nspname esquema,c.relname tabla,tg.tgname nombre,tg.tgenabled estado
    FROM pg_trigger tg JOIN pg_class c ON c.oid=tg.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE NOT tg.tgisinternal AND n.nspname IN ('public','bi');
  FOR t IN SELECT * FROM _traslado_disparadores WHERE estado<>'D' LOOP
    EXECUTE format('ALTER TABLE %I.%I DISABLE TRIGGER %I',t.esquema,t.tabla,t.nombre);
  END LOOP;

  SELECT COUNT(*),COALESCE(SUM(EXTRACT(EPOCH FROM (salida_real-ingreso_real))),0)
    INTO total_turnos,duraciones FROM public.turnos;

  -- Retirar hechos analíticos antes de mover la clave de dim_fecha.
  -- Se reconstruyen desde las fuentes operativas dentro de esta transacción.
  DELETE FROM bi.hecho_evidencia;
  DELETE FROM bi.hecho_turno;
  DELETE FROM bi.hecho_incidencia;
  CREATE TEMP TABLE _traslado_dimension_fechas ON COMMIT DROP AS
    SELECT fecha+dias AS fecha FROM bi.dim_fecha;
  DELETE FROM bi.dim_fecha;
  INSERT INTO bi.dim_fecha(fecha,anio,mes,dia,semana)
    SELECT fecha,EXTRACT(YEAR FROM fecha),EXTRACT(MONTH FROM fecha),EXTRACT(DAY FROM fecha),EXTRACT(WEEK FROM fecha)
    FROM _traslado_dimension_fechas;

  -- Fechas tipadas y fechas anidadas en JSON: auditoría, evaluaciones,
  -- filtros, hitos de custodia e importaciones, manteniendo los demás valores.
  FOR t IN
    SELECT co.table_schema,co.table_name,
      string_agg(CASE
        WHEN co.data_type='date' THEN format('%I = %I + %s',co.column_name,co.column_name,dias)
        WHEN co.data_type IN ('timestamp with time zone','timestamp without time zone')
          THEN format('%I = %I + make_interval(days => %s)',co.column_name,co.column_name,dias)
        ELSE format('%I = pg_temp.desplazar_fechas_json(%I::jsonb,%s)::%s',co.column_name,co.column_name,dias,co.data_type)
      END,', ' ORDER BY co.ordinal_position) asignaciones
    FROM information_schema.columns co
    JOIN information_schema.tables ta ON ta.table_schema=co.table_schema AND ta.table_name=co.table_name
    WHERE co.table_schema IN ('public','bi') AND ta.table_type='BASE TABLE'
      AND NOT (co.table_schema='public' AND co.table_name IN ('migraciones_aplicadas','criterios_mcda'))
      AND co.data_type IN ('date','timestamp with time zone','timestamp without time zone','json','jsonb')
      AND NOT (co.table_schema='bi' AND co.table_name IN ('dim_fecha','hecho_turno','hecho_evidencia','hecho_incidencia'))
    GROUP BY co.table_schema,co.table_name ORDER BY co.table_schema,co.table_name
  LOOP
    EXECUTE format('UPDATE %I.%I SET %s',t.table_schema,t.table_name,t.asignaciones);
  END LOOP;

  PERFORM bi.refrescar();

  IF total_turnos<>(SELECT COUNT(*) FROM public.turnos) OR
    duraciones<>(SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (salida_real-ingreso_real))),0) FROM public.turnos) THEN
    RAISE EXCEPTION 'La verificación de cantidad o duración de turnos falló';
  END IF;
  IF (SELECT (demo_generada_en AT TIME ZONE 'America/Lima')::date FROM public.configuracion_operativa WHERE id=1)<>hoy THEN
    RAISE EXCEPTION 'No se pudo actualizar la fecha base';
  END IF;

  FOR t IN SELECT * FROM _traslado_disparadores LOOP
    cambios := CASE t.estado WHEN 'A' THEN 'ENABLE ALWAYS' WHEN 'R' THEN 'ENABLE REPLICA' WHEN 'D' THEN 'DISABLE' ELSE 'ENABLE' END;
    EXECUTE format('ALTER TABLE %I.%I %s TRIGGER %I',t.esquema,t.tabla,cambios,t.nombre);
  END LOOP;
  RAISE NOTICE 'Escenario trasladado % día(s): % → %. Horarios y duraciones conservados.',dias,base,hoy;
END;
$trasladar$;
COMMIT;

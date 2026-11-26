-- Segur Track · instalación completa · generado 2026-11-21T20:18:37.772Z
-- PostgreSQL. Ejecutar con psql; detenerse ante cualquier error.
\encoding UTF8
\set ON_ERROR_STOP on
-- Crear una base NUEVA. Si ya existe, este script se detiene sin borrarla.
-- Se admite otro nombre: psql -v nombre_base=mi_base -f 01_creacion_completa.sql
\if :{?nombre_base}
\else
\set nombre_base segur_track
\endif
CREATE DATABASE :"nombre_base" WITH TEMPLATE template0 ENCODING 'UTF8';
\connect :nombre_base
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
--
-- PostgreSQL database dump
--


-- Dumped from database version 18.7 (84da7d8)
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: bi; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA bi;


--
-- Name: dw; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA dw;


--
-- Name: etl; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA etl;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: refrescar(); Type: FUNCTION; Schema: bi; Owner: -
--

CREATE FUNCTION bi.refrescar() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(741094);
 INSERT INTO bi.dim_fecha
 SELECT f,EXTRACT(YEAR FROM f),EXTRACT(MONTH FROM f),EXTRACT(DAY FROM f),EXTRACT(WEEK FROM f)
 FROM (SELECT fecha AS f FROM turnos WHERE NOT eliminado UNION SELECT (fecha_registro AT TIME ZONE 'America/Lima')::date FROM incidencias WHERE NOT eliminado) d
 ON CONFLICT DO NOTHING;
 INSERT INTO bi.dim_cliente SELECT id,nombre FROM clientes ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre;
 INSERT INTO bi.dim_personal SELECT id,nombres||' '||apellidos,cargo FROM personal ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre,cargo=excluded.cargo;
 INSERT INTO bi.dim_sede SELECT id,nombre FROM sedes ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre;
 INSERT INTO bi.dim_servicio SELECT id,nombre,cliente_id,sede_id FROM servicios ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre,cliente_id=excluded.cliente_id,sede_id=excluded.sede_id;
 DELETE FROM bi.hecho_evidencia;
 DELETE FROM bi.hecho_turno;
 DELETE FROM bi.hecho_incidencia;
 INSERT INTO bi.hecho_turno SELECT t.id,t.servicio_id,t.personal_id,t.fecha,t.inicio_programado,t.fin_programado,t.ingreso_real,t.salida_real,t.asistencia_validada,t.estado,t.puesto,to_jsonb(t) FROM vw_operacion_turnos t JOIN servicios s ON s.id=t.servicio_id WHERE NOT s.eliminado;
 INSERT INTO bi.hecho_evidencia SELECT t.id,t.evidencias_requeridas,t.evidencias_registradas,t.evidencia_limite,t.evidencia_registro FROM vw_operacion_turnos t JOIN bi.hecho_turno h ON h.id=t.id;
 INSERT INTO bi.hecho_incidencia SELECT i.id,i.servicio_id,(i.fecha_registro AT TIME ZONE 'America/Lima')::date,i.prioridad,i.estado,i.fecha_registro,i.fecha_atencion,i.fecha_cierre,i.sla_min,i.responsable_id FROM incidencias i JOIN servicios s ON s.id=i.servicio_id WHERE NOT i.eliminado AND NOT s.eliminado;
 INSERT INTO bi.cargas(turnos,incidencias) SELECT (SELECT COUNT(*) FROM bi.hecho_turno),(SELECT COUNT(*) FROM bi.hecho_incidencia);
END $$;


--
-- Name: cargar_dw(bigint, timestamp with time zone); Type: FUNCTION; Schema: etl; Owner: -
--

CREATE FUNCTION etl.cargar_dw(p_carga bigint, p_corte timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE conteos JSONB;
BEGIN
 PERFORM etl.dimension('dim_cliente',(SELECT jsonb_agg(jsonb_build_object('origen_id',id,'nombre',nombre,'atributos',jsonb_build_object('eliminado',eliminado))) FROM public.clientes),p_corte);
 PERFORM etl.dimension('dim_sede',(SELECT jsonb_agg(jsonb_build_object('origen_id',id,'nombre',nombre,'atributos',jsonb_build_object('direccion',direccion,'eliminado',eliminado))) FROM public.sedes),p_corte);
 PERFORM etl.dimension('dim_personal',(SELECT jsonb_agg(jsonb_build_object('origen_id',id,'nombre',nombres||' '||apellidos,'atributos',jsonb_build_object('cargo',cargo,'estado',estado,'eliminado',eliminado))) FROM public.personal),p_corte);
 PERFORM etl.dimension('dim_supervisor',(SELECT jsonb_agg(jsonb_build_object('origen_id',id,'nombre',nombres||' '||apellidos,'atributos',jsonb_build_object('estado',estado,'eliminado',eliminado))) FROM public.personal),p_corte);
 PERFORM etl.dimension('dim_servicio',(SELECT jsonb_agg(jsonb_build_object('origen_id',id,'nombre',nombre,'atributos',jsonb_build_object('estado',estado,'fecha_inicio',fecha_inicio,'fecha_fin',fecha_fin,'cliente_id',cliente_id,'sede_id',sede_id,'supervisor_id',supervisor_id,'eliminado',eliminado))) FROM public.servicios),p_corte);
 UPDATE dw.dim_servicio SET estado=atributos->>'estado',fecha_inicio=(atributos->>'fecha_inicio')::date,fecha_fin=(atributos->>'fecha_fin')::date,
 cliente_origen_id=(atributos->>'cliente_id')::int,sede_origen_id=(atributos->>'sede_id')::int,supervisor_origen_id=(atributos->>'supervisor_id')::int;
 UPDATE dw.dim_servicio d SET fecha_inicio=s.fecha_inicio,fecha_fin=s.fecha_fin FROM public.servicios s WHERE d.origen_id=s.id;
 INSERT INTO dw.dim_tipo_incidencia(origen_id,nombre) SELECT id,nombre FROM public.tipos_incidencia ON CONFLICT(origen_id) DO UPDATE SET nombre=EXCLUDED.nombre;
 INSERT INTO dw.dim_indicador(codigo,nombre,unidad,sentido,formula) SELECT codigo,nombre,unidad,sentido,formula FROM public.indicadores_bi ON CONFLICT(codigo) DO UPDATE SET nombre=EXCLUDED.nombre,unidad=EXCLUDED.unidad,sentido=EXCLUDED.sentido,formula=EXCLUDED.formula;
 INSERT INTO dw.dim_fecha(fecha_sk,fecha,anio,mes,dia,trimestre,semana_iso,mes_nombre)
 SELECT to_char(d,'YYYYMMDD')::int,d::date,EXTRACT(YEAR FROM d),EXTRACT(MONTH FROM d),EXTRACT(DAY FROM d),EXTRACT(QUARTER FROM d),EXTRACT(WEEK FROM d),to_char(d,'YYYY-MM')
 FROM generate_series(LEAST(COALESCE((SELECT MIN(fecha) FROM public.turnos),CURRENT_DATE),COALESCE((SELECT MIN(fecha_inicio) FROM public.servicios),CURRENT_DATE),CURRENT_DATE-INTERVAL '2 years')::date,
 GREATEST(COALESCE((SELECT MAX(fecha) FROM public.turnos),CURRENT_DATE),CURRENT_DATE+INTERVAL '2 years')::date,INTERVAL '1 day') d ON CONFLICT(fecha_sk) DO NOTHING;
 -- Fechas excepcionales de incidencias y metas también conservan una clave válida.
 INSERT INTO dw.dim_fecha(fecha_sk,fecha,anio,mes,dia,trimestre,semana_iso,mes_nombre)
 SELECT DISTINCT to_char(d,'YYYYMMDD')::int,d,EXTRACT(YEAR FROM d),EXTRACT(MONTH FROM d),EXTRACT(DAY FROM d),EXTRACT(QUARTER FROM d),EXTRACT(WEEK FROM d),to_char(d,'YYYY-MM') FROM(
 SELECT (fecha_registro AT TIME ZONE 'America/Lima')::date d FROM public.incidencias UNION SELECT (fecha_atencion AT TIME ZONE 'America/Lima')::date FROM public.incidencias UNION SELECT (fecha_cierre AT TIME ZONE 'America/Lima')::date FROM public.incidencias UNION SELECT vigente_desde FROM public.metas_bi UNION SELECT vigente_hasta FROM public.metas_bi) f WHERE d IS NOT NULL ON CONFLICT(fecha_sk) DO NOTHING;
 CREATE TEMP TABLE _dw_turnos ON COMMIT DROP AS
 SELECT t.*,ds.sk servicio_sk,COALESCE(dc.sk,0) cliente_sk,COALESCE(de.sk,0) sede_sk,COALESCE(du.sk,0) supervisor_sk,COALESCE(dp.sk,0) personal_sk,to_char(t.fecha,'YYYYMMDD')::int fecha_sk
 FROM public.vw_operacion_turnos t JOIN public.servicios s ON s.id=t.servicio_id AND NOT s.eliminado
 JOIN LATERAL(SELECT * FROM dw.dim_servicio WHERE origen_id=t.servicio_id AND vigente_desde<=t.inicio_programado AND t.inicio_programado<vigente_hasta ORDER BY vigente_desde DESC LIMIT 1)ds ON TRUE
 LEFT JOIN dw.dim_cliente dc ON dc.origen_id=ds.cliente_origen_id AND dc.vigente_desde<=t.inicio_programado AND t.inicio_programado<dc.vigente_hasta
 LEFT JOIN dw.dim_sede de ON de.origen_id=ds.sede_origen_id AND de.vigente_desde<=t.inicio_programado AND t.inicio_programado<de.vigente_hasta
 LEFT JOIN dw.dim_supervisor du ON du.origen_id=ds.supervisor_origen_id AND du.vigente_desde<=t.inicio_programado AND t.inicio_programado<du.vigente_hasta
 LEFT JOIN dw.dim_personal dp ON dp.origen_id=t.personal_id AND dp.vigente_desde<=t.inicio_programado AND t.inicio_programado<dp.vigente_hasta;
 TRUNCATE dw.fact_turno,dw.fact_obligacion,dw.fact_ronda,dw.fact_incidencia,dw.fact_servicio_diario,dw.fact_meta;
 INSERT INTO dw.fact_turno(turno_origen_id,servicio_sk,cliente_sk,sede_sk,supervisor_sk,fecha_sk,personal_sk,inicio_programado,fin_programado,ingreso_real,salida_real,tolerancia_min,estado,programados,exigibles,cubiertos,descubiertos,asignados_validados,ausentes,asistencias,tardanzas,validaciones_pendientes,carga_id)
 SELECT id,servicio_sk,cliente_sk,sede_sk,supervisor_sk,fecha_sk,personal_sk,inicio_programado,fin_programado,ingreso_real,salida_real,tolerancia_min,estado,1,
 (fin_programado<=p_corte)::int,
 (fin_programado<=p_corte AND asistencia_validada AND ingreso_real IS NOT NULL AND ingreso_real<fin_programado)::int,
 (fin_programado<=p_corte AND NOT(asistencia_validada AND ingreso_real IS NOT NULL AND ingreso_real<fin_programado))::int,
 (fin_programado<=p_corte AND personal_id IS NOT NULL AND asistencia_validada)::int,
 (fin_programado<=p_corte AND personal_id IS NOT NULL AND asistencia_validada AND ingreso_real IS NULL)::int,
 (fin_programado<=p_corte AND asistencia_validada AND ingreso_real IS NOT NULL AND ingreso_real<fin_programado)::int,
 (fin_programado<=p_corte AND asistencia_validada AND ingreso_real IS NOT NULL AND ingreso_real<fin_programado AND ingreso_real>inicio_programado+make_interval(mins=>tolerancia_min))::int,
 (fin_programado<=p_corte AND personal_id IS NOT NULL AND NOT asistencia_validada)::int,p_carga FROM _dw_turnos;
 INSERT INTO dw.fact_obligacion(obligacion_origen_id,turno_origen_id,servicio_sk,cliente_sk,sede_sk,supervisor_sk,fecha_sk,tipo_sk,fecha_limite,primera_entrega,ultima_entrega,estado_revision,programadas,exigibles,completadas,pendientes_vencidas,oportunas,revisados,observados,carga_id)
 SELECT o.id,t.id,t.servicio_sk,t.cliente_sk,t.sede_sk,t.supervisor_sk,t.fecha_sk,CASE o.tipo WHEN 'actividad' THEN 1 ELSE 2 END,o.fecha_limite,COALESCE(o.primera_entrega_en,o.fecha_completada),o.fecha_completada,o.estado_revision,1,
 (o.fecha_limite<=p_corte)::int,COALESCE((o.fecha_limite<=p_corte AND COALESCE(o.primera_entrega_en,o.fecha_completada)<=p_corte)::int,0),
 (o.fecha_limite<=p_corte AND (COALESCE(o.primera_entrega_en,o.fecha_completada) IS NULL OR COALESCE(o.primera_entrega_en,o.fecha_completada)>p_corte))::int,
 COALESCE((o.fecha_limite<=p_corte AND COALESCE(o.primera_entrega_en,o.fecha_completada)<=o.fecha_limite AND COALESCE(o.primera_entrega_en,o.fecha_completada)<=p_corte)::int,0),
 (EXISTS(SELECT 1 FROM public.revisiones_reportes r WHERE r.reporte_id=o.id AND r.revisado_en<=p_corte))::int,
 (EXISTS(SELECT 1 FROM public.revisiones_reportes r WHERE r.reporte_id=o.id AND r.estado='observado' AND r.revisado_en<=p_corte))::int,p_carga
 FROM public.obligaciones_operativas o JOIN _dw_turnos t ON t.id=o.turno_id WHERE NOT o.eliminado;
 INSERT INTO dw.fact_ronda(ronda_origen_id,turno_origen_id,servicio_sk,cliente_sk,sede_sk,supervisor_sk,fecha_sk,fecha_programada,fecha_completada,programadas,exigibles,completadas,carga_id)
 SELECT r.id,t.id,t.servicio_sk,t.cliente_sk,t.sede_sk,t.supervisor_sk,t.fecha_sk,r.fecha_programada,r.fecha_completada,1,(r.fecha_programada<=p_corte)::int,
 COALESCE((r.fecha_programada<=p_corte AND r.estado='completada' AND r.fecha_completada<=p_corte)::int,0),p_carga FROM public.rondas r JOIN _dw_turnos t ON t.id=r.turno_id WHERE NOT r.eliminado;
 INSERT INTO dw.fact_incidencia(incidencia_origen_id,codigo,servicio_sk,cliente_sk,sede_sk,supervisor_sk,fecha_sk,tipo_sk,fecha_atencion_sk,fecha_cierre_sk,fecha_registro,fecha_atencion,fecha_cierre,limite_atencion,limite_resolucion,prioridad,estado,cantidad,abiertas,atendidas,minutos_respuesta,resolucion_exigible,cerradas_en_plazo,atencion_exigible,atendidas_en_plazo,plazos_pendientes,carga_id)
 SELECT i.id,i.codigo,ds.sk,COALESCE(dc.sk,0),COALESCE(de.sk,0),COALESCE(du.sk,0),to_char(i.fecha_registro AT TIME ZONE 'America/Lima','YYYYMMDD')::int,COALESCE(dt.sk,0),
 COALESCE(to_char(i.fecha_atencion AT TIME ZONE 'America/Lima','YYYYMMDD')::int,0),COALESCE(to_char(i.fecha_cierre AT TIME ZONE 'America/Lima','YYYYMMDD')::int,0),i.fecha_registro,i.fecha_atencion,i.fecha_cierre,i.fecha_registro+make_interval(mins=>i.sla_min),COALESCE(i.plazo_resolucion_extendido,i.fecha_registro+make_interval(mins=>i.sla_resolucion_min)),i.prioridad,i.estado,1,
 (NOT(i.estado='cerrada' AND i.fecha_cierre IS NOT NULL AND i.fecha_cierre<=p_corte))::int,
 COALESCE((i.fecha_atencion BETWEEN i.fecha_registro AND p_corte)::int,0),CASE WHEN i.fecha_atencion BETWEEN i.fecha_registro AND p_corte THEN EXTRACT(EPOCH FROM i.fecha_atencion-i.fecha_registro)/60 END,
 COALESCE((i.sla_resolucion_min>0 AND (i.fecha_cierre<=p_corte OR COALESCE(i.plazo_resolucion_extendido,i.fecha_registro+make_interval(mins=>i.sla_resolucion_min))<=p_corte))::int,0),
 COALESCE((i.estado='cerrada' AND i.fecha_cierre<=p_corte AND i.fecha_cierre<=COALESCE(i.plazo_resolucion_extendido,i.fecha_registro+make_interval(mins=>i.sla_resolucion_min)))::int,0),
 COALESCE((i.sla_min>0 AND (i.fecha_atencion<=p_corte OR i.fecha_registro+make_interval(mins=>i.sla_min)<=p_corte))::int,0),
 COALESCE((i.fecha_atencion BETWEEN i.fecha_registro AND LEAST(p_corte,i.fecha_registro+make_interval(mins=>i.sla_min)))::int,0),
 (i.sla_min IS NULL OR i.sla_resolucion_min IS NULL)::int,p_carga
 FROM public.incidencias i JOIN public.servicios s ON s.id=i.servicio_id AND NOT s.eliminado
 JOIN LATERAL(SELECT * FROM dw.dim_servicio WHERE origen_id=i.servicio_id AND vigente_desde<=i.fecha_registro AND i.fecha_registro<vigente_hasta ORDER BY vigente_desde DESC LIMIT 1)ds ON TRUE
 LEFT JOIN dw.dim_cliente dc ON dc.origen_id=ds.cliente_origen_id AND dc.vigente_desde<=i.fecha_registro AND i.fecha_registro<dc.vigente_hasta
 LEFT JOIN dw.dim_sede de ON de.origen_id=ds.sede_origen_id AND de.vigente_desde<=i.fecha_registro AND i.fecha_registro<de.vigente_hasta
 LEFT JOIN dw.dim_supervisor du ON du.origen_id=ds.supervisor_origen_id AND du.vigente_desde<=i.fecha_registro AND i.fecha_registro<du.vigente_hasta
 LEFT JOIN dw.dim_tipo_incidencia dt ON dt.origen_id=i.tipo_incidencia_id WHERE NOT i.eliminado AND i.fecha_registro<=p_corte;

 UPDATE dw.fact_incidencia f SET
   limite_resolucion_original=i.fecha_registro+make_interval(mins=>i.sla_resolucion_min),
   ampliaciones_aprobadas=(SELECT COUNT(*) FROM public.incidencias_ampliaciones a WHERE a.incidencia_id=i.id AND a.estado='aprobada' AND a.decidido_en<=p_corte),
   minutos_ampliados=CASE WHEN i.plazo_resolucion_extendido IS NOT NULL THEN EXTRACT(EPOCH FROM (i.plazo_resolucion_extendido-i.fecha_registro))/60-i.sla_resolucion_min ELSE 0 END,
   ampliacion_pendiente=(EXISTS(SELECT 1 FROM public.incidencias_ampliaciones a WHERE a.incidencia_id=i.id AND a.estado='pendiente'))::int
 FROM public.incidencias i WHERE i.id=f.incidencia_origen_id;
 INSERT INTO dw.fact_servicio_diario
 (servicio_origen_id,servicio_sk,cliente_sk,sede_sk,supervisor_sk,fecha_sk,activo,carga_id)
 SELECT s.id,ds.sk,COALESCE(dc.sk,0),COALESCE(de.sk,0),COALESCE(du.sk,0),to_char(f.d,'YYYYMMDD')::int,1,p_carga
 FROM public.servicios s CROSS JOIN LATERAL generate_series(s.fecha_inicio,LEAST(COALESCE(s.fecha_fin,CASE WHEN s.estado='finalizado' THEN (s.actualizado_en AT TIME ZONE 'America/Lima')::date ELSE (p_corte AT TIME ZONE 'America/Lima')::date END),(p_corte AT TIME ZONE 'America/Lima')::date),INTERVAL '1 day') f(d)
 JOIN LATERAL(SELECT * FROM dw.dim_servicio WHERE origen_id=s.id AND vigente_desde<=LEAST((f.d::date+TIME '23:59:59') AT TIME ZONE 'America/Lima',p_corte) AND LEAST((f.d::date+TIME '23:59:59') AT TIME ZONE 'America/Lima',p_corte)<vigente_hasta ORDER BY vigente_desde DESC LIMIT 1)ds ON TRUE
 LEFT JOIN dw.dim_cliente dc ON dc.origen_id=ds.cliente_origen_id AND dc.vigente_desde<=LEAST((f.d::date+TIME '23:59:59') AT TIME ZONE 'America/Lima',p_corte) AND LEAST((f.d::date+TIME '23:59:59') AT TIME ZONE 'America/Lima',p_corte)<dc.vigente_hasta
 LEFT JOIN dw.dim_sede de ON de.origen_id=ds.sede_origen_id AND de.vigente_desde<=LEAST((f.d::date+TIME '23:59:59') AT TIME ZONE 'America/Lima',p_corte) AND LEAST((f.d::date+TIME '23:59:59') AT TIME ZONE 'America/Lima',p_corte)<de.vigente_hasta
 LEFT JOIN dw.dim_supervisor du ON du.origen_id=ds.supervisor_origen_id AND du.vigente_desde<=LEAST((f.d::date+TIME '23:59:59') AT TIME ZONE 'America/Lima',p_corte) AND LEAST((f.d::date+TIME '23:59:59') AT TIME ZONE 'America/Lima',p_corte)<du.vigente_hasta
 WHERE NOT s.eliminado;
 INSERT INTO dw.fact_meta(indicador_sk,desde_sk,hasta_sk,vigente_desde,vigente_hasta,valor,carga_id)
 SELECT d.sk,to_char(m.vigente_desde,'YYYYMMDD')::int,COALESCE(to_char(m.vigente_hasta,'YYYYMMDD')::int,0),m.vigente_desde,m.vigente_hasta,m.valor,p_carga FROM public.metas_bi m JOIN dw.dim_indicador d ON d.codigo=m.codigo;
 SELECT jsonb_build_object('turnos',(SELECT COUNT(*) FROM dw.fact_turno),'obligaciones',(SELECT COUNT(*) FROM dw.fact_obligacion),'rondas',(SELECT COUNT(*) FROM dw.fact_ronda),'incidencias',(SELECT COUNT(*) FROM dw.fact_incidencia),'servicios_dia',(SELECT COUNT(*) FROM dw.fact_servicio_diario)) INTO conteos;
 UPDATE etl.estado SET ultima_carga_en=p_corte,ultimo_id=p_carga WHERE id=1;
 RETURN conteos;
END $$;


--
-- Name: dimension(text, jsonb, timestamp with time zone); Type: FUNCTION; Schema: etl; Owner: -
--

CREATE FUNCTION etl.dimension(tabla text, registros jsonb, corte timestamp with time zone) RETURNS void
    LANGUAGE plpgsql
    AS $_$
BEGIN
 IF tabla NOT IN ('dim_cliente','dim_sede','dim_supervisor','dim_personal','dim_servicio') THEN RAISE EXCEPTION 'Dimensión inválida'; END IF;
 EXECUTE format($q$WITH s AS(SELECT * FROM jsonb_to_recordset($1) x(origen_id int,nombre text,atributos jsonb))
 UPDATE dw.%I d SET actual=FALSE,vigente_hasta=$2 FROM s WHERE d.origen_id=s.origen_id AND d.actual
 AND d.huella<>md5(jsonb_build_object('nombre',s.nombre,'atributos',s.atributos)::text)$q$,tabla) USING COALESCE(registros,'[]'),corte;
 EXECUTE format($q$INSERT INTO dw.%I(origen_id,nombre,atributos,huella,vigente_desde)
 SELECT s.origen_id,s.nombre,s.atributos,md5(jsonb_build_object('nombre',s.nombre,'atributos',s.atributos)::text),
 CASE WHEN EXISTS(SELECT 1 FROM dw.%I d WHERE d.origen_id=s.origen_id) THEN $2 ELSE '-infinity'::timestamptz END
 FROM jsonb_to_recordset($1) s(origen_id int,nombre text,atributos jsonb)
 WHERE NOT EXISTS(SELECT 1 FROM dw.%I d WHERE d.origen_id=s.origen_id AND d.actual)$q$,tabla,tabla,tabla) USING COALESCE(registros,'[]'),corte;
END $_$;


--
-- Name: auditar_incidencia(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auditar_incidencia() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 INSERT INTO incidencias_historial(incidencia_id,anterior,nuevo,usuario_id)
 VALUES(NEW.id,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW),NULLIF(current_setting('app.usuario_id',true),'')::int);
 RETURN NEW;
END $$;


--
-- Name: auditar_turno(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auditar_turno() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO turnos_historial(turno_id,nuevo,usuario_id,motivo)
  VALUES(NEW.id,to_jsonb(NEW),NULLIF(current_setting('app.usuario_id',true),'')::int,COALESCE(NULLIF(current_setting('app.motivo',true),''),'Creación'));
 ELSIF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
  INSERT INTO turnos_historial(turno_id,anterior,nuevo,usuario_id,motivo)
  VALUES(NEW.id,to_jsonb(OLD),to_jsonb(NEW),NULLIF(current_setting('app.usuario_id',true),'')::int,NULLIF(current_setting('app.motivo',true),''));
 END IF;
 RETURN NEW;
END $$;


--
-- Name: completar_plazos_incidencia(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.completar_plazos_incidencia() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE cfg configuracion_operativa%ROWTYPE;
BEGIN
 SELECT * INTO cfg FROM configuracion_operativa WHERE id=1;
 IF NEW.sla_min IS NULL THEN
   NEW.sla_min := CASE NEW.prioridad WHEN 'alta' THEN cfg.sla_alta WHEN 'media' THEN cfg.sla_media ELSE cfg.sla_baja END;
 END IF;
 IF NEW.sla_resolucion_min IS NULL THEN
   NEW.sla_resolucion_min := CASE NEW.prioridad WHEN 'alta' THEN cfg.resolucion_alta WHEN 'media' THEN cfg.resolucion_media ELSE cfg.resolucion_baja END;
   NEW.origen_plazo := 'configuracion_vigente';
 END IF;
 RETURN NEW;
END $$;


--
-- Name: generar_plan_turno(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generar_plan_turno() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN PERFORM programar_plan_turno(NEW.id); RETURN NEW; END $$;


--
-- Name: programar_plan_turno(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.programar_plan_turno(turno integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE t turnos%ROWTYPE; p RECORD; inicio TIMESTAMPTZ; fin TIMESTAMPTZ;
 duracion INT; minuto INT; sec INT; actor INT;
BEGIN
 SELECT * INTO t FROM turnos WHERE id=turno AND NOT eliminado FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM planes_operativos WHERE servicio_id=t.servicio_id AND confirmado) THEN
   UPDATE turnos SET plan_kpi_validado=FALSE WHERE id=turno AND plan_kpi_validado;
   RETURN;
 END IF;
 inicio := (t.fecha+t.hora_inicio) AT TIME ZONE 'America/Lima';
 fin := (t.fecha+t.hora_fin+CASE WHEN t.hora_fin<=t.hora_inicio THEN INTERVAL '1 day' ELSE INTERVAL '0' END) AT TIME ZONE 'America/Lima';
 duracion := EXTRACT(EPOCH FROM fin-inicio)::INT/60;
 SELECT COALESCE(t.creado_por,actualizado_por) INTO actor FROM planes_operativos WHERE servicio_id=t.servicio_id;
 UPDATE obligaciones_operativas o SET eliminado=TRUE,actualizado_en=NOW()
 WHERE o.turno_id=turno AND o.plantilla_id IS NOT NULL AND o.fecha_completada IS NULL AND NOT o.eliminado
 AND NOT EXISTS(SELECT 1 FROM plantillas_operativas pp WHERE pp.id=o.plantilla_id AND pp.servicio_id=t.servicio_id AND pp.activo);
 UPDATE rondas r SET eliminado=TRUE,actualizado_en=NOW()
 WHERE r.turno_id=turno AND r.plantilla_id IS NOT NULL AND r.fecha_completada IS NULL AND NOT r.eliminado
 AND NOT EXISTS(SELECT 1 FROM plantillas_operativas pp WHERE pp.id=r.plantilla_id AND pp.servicio_id=t.servicio_id AND pp.activo);
 FOR p IN SELECT * FROM plantillas_operativas WHERE servicio_id=t.servicio_id AND activo ORDER BY id LOOP
   sec := 0;
   FOR minuto IN SELECT generate_series(LEAST(COALESCE(p.minutos_desde_inicio,duracion),duracion),
     CASE WHEN p.intervalo_min IS NULL THEN LEAST(COALESCE(p.minutos_desde_inicio,duracion),duracion) ELSE duracion END,
     COALESCE(p.intervalo_min,duracion+1)) LOOP
     sec := sec+1;
     IF p.tipo='ronda' THEN
       INSERT INTO rondas(turno_id,servicio_id,fecha_programada,ruta,creado_por,plantilla_id,secuencia,origen)
       VALUES(turno,t.servicio_id,inicio+make_interval(mins=>minuto),p.descripcion,actor,p.id,sec,'plan_servicio')
       ON CONFLICT(turno_id,plantilla_id,secuencia) WHERE NOT eliminado DO UPDATE
       SET fecha_programada=EXCLUDED.fecha_programada,ruta=EXCLUDED.ruta
       WHERE rondas.fecha_completada IS NULL;
     ELSE
       INSERT INTO obligaciones_operativas(turno_id,tipo,descripcion,fecha_limite,creado_por,plantilla_id,secuencia,origen)
       VALUES(turno,p.tipo,p.descripcion,inicio+make_interval(mins=>minuto),actor,p.id,sec,'plan_servicio')
       ON CONFLICT(turno_id,plantilla_id,secuencia) WHERE NOT eliminado DO UPDATE
       SET fecha_limite=EXCLUDED.fecha_limite,descripcion=EXCLUDED.descripcion
       WHERE obligaciones_operativas.fecha_completada IS NULL;
     END IF;
   END LOOP;
 END LOOP;
 UPDATE turnos SET plan_kpi_validado=TRUE WHERE id=turno AND NOT plan_kpi_validado;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cargas; Type: TABLE; Schema: bi; Owner: -
--

CREATE TABLE bi.cargas (
    id bigint NOT NULL,
    fecha timestamp with time zone DEFAULT now(),
    turnos integer,
    incidencias integer
);


--
-- Name: cargas_id_seq; Type: SEQUENCE; Schema: bi; Owner: -
--

CREATE SEQUENCE bi.cargas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cargas_id_seq; Type: SEQUENCE OWNED BY; Schema: bi; Owner: -
--

ALTER SEQUENCE bi.cargas_id_seq OWNED BY bi.cargas.id;


--
-- Name: dim_cliente; Type: TABLE; Schema: bi; Owner: -
--

CREATE TABLE bi.dim_cliente (
    id integer NOT NULL,
    nombre text NOT NULL
);


--
-- Name: dim_fecha; Type: TABLE; Schema: bi; Owner: -
--

CREATE TABLE bi.dim_fecha (
    fecha date NOT NULL,
    anio integer NOT NULL,
    mes integer NOT NULL,
    dia integer NOT NULL,
    semana integer NOT NULL
);


--
-- Name: dim_personal; Type: TABLE; Schema: bi; Owner: -
--

CREATE TABLE bi.dim_personal (
    id integer NOT NULL,
    nombre text NOT NULL,
    cargo text NOT NULL
);


--
-- Name: dim_sede; Type: TABLE; Schema: bi; Owner: -
--

CREATE TABLE bi.dim_sede (
    id integer NOT NULL,
    nombre text NOT NULL
);


--
-- Name: dim_servicio; Type: TABLE; Schema: bi; Owner: -
--

CREATE TABLE bi.dim_servicio (
    id integer NOT NULL,
    nombre text NOT NULL,
    cliente_id integer,
    sede_id integer
);


--
-- Name: hecho_evidencia; Type: TABLE; Schema: bi; Owner: -
--

CREATE TABLE bi.hecho_evidencia (
    turno_id integer NOT NULL,
    requeridas integer,
    registradas integer,
    limite timestamp with time zone,
    registro timestamp with time zone
);


--
-- Name: hecho_incidencia; Type: TABLE; Schema: bi; Owner: -
--

CREATE TABLE bi.hecho_incidencia (
    id integer NOT NULL,
    servicio_id integer,
    fecha date,
    prioridad text,
    estado text,
    registro timestamp with time zone,
    atencion timestamp with time zone,
    cierre timestamp with time zone,
    sla_min integer,
    responsable_id integer
);


--
-- Name: hecho_turno; Type: TABLE; Schema: bi; Owner: -
--

CREATE TABLE bi.hecho_turno (
    id integer NOT NULL,
    servicio_id integer,
    personal_id integer,
    fecha date,
    inicio_programado timestamp with time zone,
    fin_programado timestamp with time zone,
    ingreso_real timestamp with time zone,
    salida_real timestamp with time zone,
    asistencia_validada boolean,
    estado text,
    puesto text,
    fuente jsonb NOT NULL
);


--
-- Name: dim_cliente; Type: TABLE; Schema: dw; Owner: -
--

CREATE TABLE dw.dim_cliente (
    sk bigint NOT NULL,
    origen_id integer NOT NULL,
    nombre text NOT NULL,
    atributos jsonb DEFAULT '{}'::jsonb NOT NULL,
    huella text NOT NULL,
    vigente_desde timestamp with time zone DEFAULT '-infinity'::timestamp with time zone NOT NULL,
    vigente_hasta timestamp with time zone DEFAULT 'infinity'::timestamp with time zone NOT NULL,
    actual boolean DEFAULT true NOT NULL,
    CONSTRAINT dim_cliente_check CHECK ((vigente_desde < vigente_hasta))
);


--
-- Name: dim_cliente_sk_seq; Type: SEQUENCE; Schema: dw; Owner: -
--

CREATE SEQUENCE dw.dim_cliente_sk_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dim_cliente_sk_seq; Type: SEQUENCE OWNED BY; Schema: dw; Owner: -
--

ALTER SEQUENCE dw.dim_cliente_sk_seq OWNED BY dw.dim_cliente.sk;


--
-- Name: dim_fecha; Type: TABLE; Schema: dw; Owner: -
--

CREATE TABLE dw.dim_fecha (
    fecha_sk integer NOT NULL,
    fecha date,
    anio integer,
    mes integer,
    dia integer,
    trimestre integer,
    semana_iso integer,
    mes_nombre text
);


--
-- Name: dim_indicador; Type: TABLE; Schema: dw; Owner: -
--

CREATE TABLE dw.dim_indicador (
    sk bigint NOT NULL,
    codigo text NOT NULL,
    nombre text NOT NULL,
    unidad text NOT NULL,
    sentido text NOT NULL,
    formula text NOT NULL
);


--
-- Name: dim_indicador_sk_seq; Type: SEQUENCE; Schema: dw; Owner: -
--

CREATE SEQUENCE dw.dim_indicador_sk_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dim_indicador_sk_seq; Type: SEQUENCE OWNED BY; Schema: dw; Owner: -
--

ALTER SEQUENCE dw.dim_indicador_sk_seq OWNED BY dw.dim_indicador.sk;


--
-- Name: dim_personal; Type: TABLE; Schema: dw; Owner: -
--

CREATE TABLE dw.dim_personal (
    sk bigint NOT NULL,
    origen_id integer NOT NULL,
    nombre text NOT NULL,
    atributos jsonb DEFAULT '{}'::jsonb NOT NULL,
    huella text NOT NULL,
    vigente_desde timestamp with time zone DEFAULT '-infinity'::timestamp with time zone NOT NULL,
    vigente_hasta timestamp with time zone DEFAULT 'infinity'::timestamp with time zone NOT NULL,
    actual boolean DEFAULT true NOT NULL,
    CONSTRAINT dim_personal_check CHECK ((vigente_desde < vigente_hasta))
);


--
-- Name: dim_personal_sk_seq; Type: SEQUENCE; Schema: dw; Owner: -
--

CREATE SEQUENCE dw.dim_personal_sk_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dim_personal_sk_seq; Type: SEQUENCE OWNED BY; Schema: dw; Owner: -
--

ALTER SEQUENCE dw.dim_personal_sk_seq OWNED BY dw.dim_personal.sk;


--
-- Name: dim_sede; Type: TABLE; Schema: dw; Owner: -
--

CREATE TABLE dw.dim_sede (
    sk bigint NOT NULL,
    origen_id integer NOT NULL,
    nombre text NOT NULL,
    atributos jsonb DEFAULT '{}'::jsonb NOT NULL,
    huella text NOT NULL,
    vigente_desde timestamp with time zone DEFAULT '-infinity'::timestamp with time zone NOT NULL,
    vigente_hasta timestamp with time zone DEFAULT 'infinity'::timestamp with time zone NOT NULL,
    actual boolean DEFAULT true NOT NULL,
    CONSTRAINT dim_sede_check CHECK ((vigente_desde < vigente_hasta))
);


--
-- Name: dim_sede_sk_seq; Type: SEQUENCE; Schema: dw; Owner: -
--

CREATE SEQUENCE dw.dim_sede_sk_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dim_sede_sk_seq; Type: SEQUENCE OWNED BY; Schema: dw; Owner: -
--

ALTER SEQUENCE dw.dim_sede_sk_seq OWNED BY dw.dim_sede.sk;


--
-- Name: dim_servicio; Type: TABLE; Schema: dw; Owner: -
--

CREATE TABLE dw.dim_servicio (
    sk bigint NOT NULL,
    origen_id integer NOT NULL,
    nombre text NOT NULL,
    atributos jsonb DEFAULT '{}'::jsonb NOT NULL,
    huella text NOT NULL,
    vigente_desde timestamp with time zone DEFAULT '-infinity'::timestamp with time zone NOT NULL,
    vigente_hasta timestamp with time zone DEFAULT 'infinity'::timestamp with time zone NOT NULL,
    actual boolean DEFAULT true NOT NULL,
    estado text,
    fecha_inicio date,
    fecha_fin date,
    cliente_origen_id integer,
    sede_origen_id integer,
    supervisor_origen_id integer,
    CONSTRAINT dim_servicio_check CHECK ((vigente_desde < vigente_hasta))
);


--
-- Name: dim_servicio_sk_seq; Type: SEQUENCE; Schema: dw; Owner: -
--

CREATE SEQUENCE dw.dim_servicio_sk_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dim_servicio_sk_seq; Type: SEQUENCE OWNED BY; Schema: dw; Owner: -
--

ALTER SEQUENCE dw.dim_servicio_sk_seq OWNED BY dw.dim_servicio.sk;


--
-- Name: dim_supervisor; Type: TABLE; Schema: dw; Owner: -
--

CREATE TABLE dw.dim_supervisor (
    sk bigint NOT NULL,
    origen_id integer NOT NULL,
    nombre text NOT NULL,
    atributos jsonb DEFAULT '{}'::jsonb NOT NULL,
    huella text NOT NULL,
    vigente_desde timestamp with time zone DEFAULT '-infinity'::timestamp with time zone NOT NULL,
    vigente_hasta timestamp with time zone DEFAULT 'infinity'::timestamp with time zone NOT NULL,
    actual boolean DEFAULT true NOT NULL,
    CONSTRAINT dim_supervisor_check CHECK ((vigente_desde < vigente_hasta))
);


--
-- Name: dim_supervisor_sk_seq; Type: SEQUENCE; Schema: dw; Owner: -
--

CREATE SEQUENCE dw.dim_supervisor_sk_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dim_supervisor_sk_seq; Type: SEQUENCE OWNED BY; Schema: dw; Owner: -
--

ALTER SEQUENCE dw.dim_supervisor_sk_seq OWNED BY dw.dim_supervisor.sk;


--
-- Name: dim_tipo_incidencia; Type: TABLE; Schema: dw; Owner: -
--

CREATE TABLE dw.dim_tipo_incidencia (
    sk bigint NOT NULL,
    origen_id integer NOT NULL,
    nombre text NOT NULL
);


--
-- Name: dim_tipo_incidencia_sk_seq; Type: SEQUENCE; Schema: dw; Owner: -
--

CREATE SEQUENCE dw.dim_tipo_incidencia_sk_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dim_tipo_incidencia_sk_seq; Type: SEQUENCE OWNED BY; Schema: dw; Owner: -
--

ALTER SEQUENCE dw.dim_tipo_incidencia_sk_seq OWNED BY dw.dim_tipo_incidencia.sk;


--
-- Name: dim_tipo_obligacion; Type: TABLE; Schema: dw; Owner: -
--

CREATE TABLE dw.dim_tipo_obligacion (
    sk integer NOT NULL,
    nombre text NOT NULL
);


--
-- Name: fact_incidencia; Type: TABLE; Schema: dw; Owner: -
--

CREATE TABLE dw.fact_incidencia (
    sk bigint NOT NULL,
    incidencia_origen_id integer NOT NULL,
    codigo text,
    servicio_sk bigint NOT NULL,
    cliente_sk bigint NOT NULL,
    sede_sk bigint NOT NULL,
    supervisor_sk bigint NOT NULL,
    fecha_sk integer NOT NULL,
    tipo_sk bigint NOT NULL,
    fecha_atencion_sk integer NOT NULL,
    fecha_cierre_sk integer NOT NULL,
    fecha_registro timestamp with time zone,
    fecha_atencion timestamp with time zone,
    fecha_cierre timestamp with time zone,
    limite_atencion timestamp with time zone,
    limite_resolucion timestamp with time zone,
    prioridad text,
    estado text,
    cantidad integer NOT NULL,
    abiertas integer NOT NULL,
    atendidas integer NOT NULL,
    minutos_respuesta numeric,
    resolucion_exigible integer NOT NULL,
    cerradas_en_plazo integer NOT NULL,
    atencion_exigible integer NOT NULL,
    atendidas_en_plazo integer NOT NULL,
    plazos_pendientes integer NOT NULL,
    carga_id bigint NOT NULL,
    limite_resolucion_original timestamp with time zone,
    ampliaciones_aprobadas integer DEFAULT 0 NOT NULL,
    minutos_ampliados numeric DEFAULT 0 NOT NULL,
    ampliacion_pendiente integer DEFAULT 0 NOT NULL
);


--
-- Name: fact_incidencia_sk_seq; Type: SEQUENCE; Schema: dw; Owner: -
--

CREATE SEQUENCE dw.fact_incidencia_sk_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fact_incidencia_sk_seq; Type: SEQUENCE OWNED BY; Schema: dw; Owner: -
--

ALTER SEQUENCE dw.fact_incidencia_sk_seq OWNED BY dw.fact_incidencia.sk;


--
-- Name: fact_meta; Type: TABLE; Schema: dw; Owner: -
--

CREATE TABLE dw.fact_meta (
    sk bigint NOT NULL,
    indicador_sk bigint NOT NULL,
    desde_sk integer NOT NULL,
    hasta_sk integer NOT NULL,
    vigente_desde date NOT NULL,
    vigente_hasta date,
    valor numeric,
    carga_id bigint NOT NULL
);


--
-- Name: fact_meta_sk_seq; Type: SEQUENCE; Schema: dw; Owner: -
--

CREATE SEQUENCE dw.fact_meta_sk_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fact_meta_sk_seq; Type: SEQUENCE OWNED BY; Schema: dw; Owner: -
--

ALTER SEQUENCE dw.fact_meta_sk_seq OWNED BY dw.fact_meta.sk;


--
-- Name: fact_obligacion; Type: TABLE; Schema: dw; Owner: -
--

CREATE TABLE dw.fact_obligacion (
    sk bigint NOT NULL,
    obligacion_origen_id integer NOT NULL,
    turno_origen_id integer NOT NULL,
    servicio_sk bigint NOT NULL,
    cliente_sk bigint NOT NULL,
    sede_sk bigint NOT NULL,
    supervisor_sk bigint NOT NULL,
    fecha_sk integer NOT NULL,
    tipo_sk integer NOT NULL,
    fecha_limite timestamp with time zone,
    primera_entrega timestamp with time zone,
    ultima_entrega timestamp with time zone,
    estado_revision text,
    programadas integer NOT NULL,
    exigibles integer NOT NULL,
    completadas integer NOT NULL,
    pendientes_vencidas integer NOT NULL,
    oportunas integer NOT NULL,
    revisados integer NOT NULL,
    observados integer NOT NULL,
    carga_id bigint NOT NULL
);


--
-- Name: fact_obligacion_sk_seq; Type: SEQUENCE; Schema: dw; Owner: -
--

CREATE SEQUENCE dw.fact_obligacion_sk_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fact_obligacion_sk_seq; Type: SEQUENCE OWNED BY; Schema: dw; Owner: -
--

ALTER SEQUENCE dw.fact_obligacion_sk_seq OWNED BY dw.fact_obligacion.sk;


--
-- Name: fact_ronda; Type: TABLE; Schema: dw; Owner: -
--

CREATE TABLE dw.fact_ronda (
    sk bigint NOT NULL,
    ronda_origen_id integer NOT NULL,
    turno_origen_id integer NOT NULL,
    servicio_sk bigint NOT NULL,
    cliente_sk bigint NOT NULL,
    sede_sk bigint NOT NULL,
    supervisor_sk bigint NOT NULL,
    fecha_sk integer NOT NULL,
    fecha_programada timestamp with time zone,
    fecha_completada timestamp with time zone,
    programadas integer NOT NULL,
    exigibles integer NOT NULL,
    completadas integer NOT NULL,
    carga_id bigint NOT NULL
);


--
-- Name: fact_ronda_sk_seq; Type: SEQUENCE; Schema: dw; Owner: -
--

CREATE SEQUENCE dw.fact_ronda_sk_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fact_ronda_sk_seq; Type: SEQUENCE OWNED BY; Schema: dw; Owner: -
--

ALTER SEQUENCE dw.fact_ronda_sk_seq OWNED BY dw.fact_ronda.sk;


--
-- Name: fact_servicio_diario; Type: TABLE; Schema: dw; Owner: -
--

CREATE TABLE dw.fact_servicio_diario (
    sk bigint NOT NULL,
    servicio_origen_id integer NOT NULL,
    servicio_sk bigint NOT NULL,
    cliente_sk bigint NOT NULL,
    sede_sk bigint NOT NULL,
    supervisor_sk bigint NOT NULL,
    fecha_sk integer NOT NULL,
    activo integer NOT NULL,
    carga_id bigint NOT NULL
);


--
-- Name: fact_servicio_diario_sk_seq; Type: SEQUENCE; Schema: dw; Owner: -
--

CREATE SEQUENCE dw.fact_servicio_diario_sk_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fact_servicio_diario_sk_seq; Type: SEQUENCE OWNED BY; Schema: dw; Owner: -
--

ALTER SEQUENCE dw.fact_servicio_diario_sk_seq OWNED BY dw.fact_servicio_diario.sk;


--
-- Name: fact_turno; Type: TABLE; Schema: dw; Owner: -
--

CREATE TABLE dw.fact_turno (
    sk bigint NOT NULL,
    turno_origen_id integer NOT NULL,
    servicio_sk bigint NOT NULL,
    cliente_sk bigint NOT NULL,
    sede_sk bigint NOT NULL,
    supervisor_sk bigint NOT NULL,
    fecha_sk integer NOT NULL,
    personal_sk bigint NOT NULL,
    inicio_programado timestamp with time zone,
    fin_programado timestamp with time zone,
    ingreso_real timestamp with time zone,
    salida_real timestamp with time zone,
    tolerancia_min integer,
    estado text,
    programados integer NOT NULL,
    exigibles integer NOT NULL,
    cubiertos integer NOT NULL,
    descubiertos integer NOT NULL,
    asignados_validados integer NOT NULL,
    ausentes integer NOT NULL,
    asistencias integer NOT NULL,
    tardanzas integer NOT NULL,
    validaciones_pendientes integer NOT NULL,
    carga_id bigint NOT NULL
);


--
-- Name: fact_turno_sk_seq; Type: SEQUENCE; Schema: dw; Owner: -
--

CREATE SEQUENCE dw.fact_turno_sk_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fact_turno_sk_seq; Type: SEQUENCE OWNED BY; Schema: dw; Owner: -
--

ALTER SEQUENCE dw.fact_turno_sk_seq OWNED BY dw.fact_turno.sk;


--
-- Name: ejecuciones; Type: TABLE; Schema: etl; Owner: -
--

CREATE TABLE etl.ejecuciones (
    id bigint NOT NULL,
    origen text NOT NULL,
    usuario_origen_id integer,
    iniciado_en timestamp with time zone DEFAULT now() NOT NULL,
    finalizado_en timestamp with time zone,
    estado text NOT NULL,
    detalle jsonb,
    error text,
    CONSTRAINT ejecuciones_estado_check CHECK ((estado = ANY (ARRAY['ejecutando'::text, 'completado'::text, 'error'::text, 'interrumpido'::text])))
);


--
-- Name: ejecuciones_id_seq; Type: SEQUENCE; Schema: etl; Owner: -
--

CREATE SEQUENCE etl.ejecuciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ejecuciones_id_seq; Type: SEQUENCE OWNED BY; Schema: etl; Owner: -
--

ALTER SEQUENCE etl.ejecuciones_id_seq OWNED BY etl.ejecuciones.id;


--
-- Name: estado; Type: TABLE; Schema: etl; Owner: -
--

CREATE TABLE etl.estado (
    id integer NOT NULL,
    ultima_carga_en timestamp with time zone,
    ultimo_id bigint,
    intervalo_min integer DEFAULT 60 NOT NULL,
    CONSTRAINT estado_id_check CHECK ((id = 1)),
    CONSTRAINT estado_intervalo_min_check CHECK ((intervalo_min = 60))
);


--
-- Name: actividad_reciente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.actividad_reciente (
    id integer NOT NULL,
    tipo character varying(40) NOT NULL,
    descripcion text NOT NULL,
    usuario_id integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: actividad_reciente_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.actividad_reciente_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: actividad_reciente_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.actividad_reciente_id_seq OWNED BY public.actividad_reciente.id;


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    id integer NOT NULL,
    nombre character varying(120) NOT NULL,
    contacto character varying(120),
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clientes_id_seq OWNED BY public.clientes.id;


--
-- Name: configuracion_operativa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracion_operativa (
    id integer NOT NULL,
    sla_alta integer DEFAULT 60 NOT NULL,
    sla_media integer DEFAULT 240 NOT NULL,
    sla_baja integer DEFAULT 1440 NOT NULL,
    datos_demo boolean DEFAULT false NOT NULL,
    demo_generada_en timestamp with time zone,
    resolucion_alta integer DEFAULT 240 NOT NULL,
    resolucion_media integer DEFAULT 1440 NOT NULL,
    resolucion_baja integer DEFAULT 2880 NOT NULL,
    CONSTRAINT configuracion_operativa_id_check CHECK ((id = 1)),
    CONSTRAINT configuracion_operativa_resolucion_alta_check CHECK ((resolucion_alta > 0)),
    CONSTRAINT configuracion_operativa_resolucion_baja_check CHECK ((resolucion_baja > 0)),
    CONSTRAINT configuracion_operativa_resolucion_media_check CHECK ((resolucion_media > 0)),
    CONSTRAINT configuracion_operativa_sla_alta_check CHECK ((sla_alta > 0)),
    CONSTRAINT configuracion_operativa_sla_baja_check CHECK ((sla_baja > 0)),
    CONSTRAINT configuracion_operativa_sla_media_check CHECK ((sla_media > 0))
);


--
-- Name: consignas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consignas (
    id integer NOT NULL,
    servicio_id integer NOT NULL,
    descripcion text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: consignas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.consignas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: consignas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.consignas_id_seq OWNED BY public.consignas.id;


--
-- Name: contenedores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contenedores (
    id integer NOT NULL,
    codigo text NOT NULL
);


--
-- Name: contenedores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contenedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contenedores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contenedores_id_seq OWNED BY public.contenedores.id;


--
-- Name: criterios_mcda; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.criterios_mcda (
    id integer NOT NULL,
    codigo character varying(10) NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    peso numeric(4,3) DEFAULT 0.200 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: criterios_mcda_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.criterios_mcda_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: criterios_mcda_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.criterios_mcda_id_seq OWNED BY public.criterios_mcda.id;


--
-- Name: evaluacion_criterios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluacion_criterios (
    id integer NOT NULL,
    evaluacion_id integer NOT NULL,
    criterio_id integer NOT NULL,
    puntaje numeric(5,2) NOT NULL,
    influye boolean DEFAULT false NOT NULL,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT evaluacion_criterios_puntaje_check CHECK (((puntaje >= (0)::numeric) AND (puntaje <= (100)::numeric)))
);


--
-- Name: evaluacion_criterios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evaluacion_criterios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evaluacion_criterios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evaluacion_criterios_id_seq OWNED BY public.evaluacion_criterios.id;


--
-- Name: evaluaciones_multicriterio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluaciones_multicriterio (
    id integer NOT NULL,
    servicio_id integer NOT NULL,
    fecha_evaluacion timestamp with time zone DEFAULT now() NOT NULL,
    puntaje_global numeric(5,2) NOT NULL,
    nivel character varying(5) NOT NULL,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT evaluaciones_multicriterio_nivel_check CHECK (((nivel)::text = ANY ((ARRAY['alta'::character varying, 'media'::character varying, 'baja'::character varying])::text[]))),
    CONSTRAINT evaluaciones_multicriterio_puntaje_global_check CHECK (((puntaje_global >= (0)::numeric) AND (puntaje_global <= (100)::numeric)))
);


--
-- Name: evaluaciones_multicriterio_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evaluaciones_multicriterio_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evaluaciones_multicriterio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evaluaciones_multicriterio_id_seq OWNED BY public.evaluaciones_multicriterio.id;


--
-- Name: evaluaciones_operativas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluaciones_operativas (
    id bigint NOT NULL,
    servicio_id integer NOT NULL,
    usuario_id integer,
    version text NOT NULL,
    filtros jsonb NOT NULL,
    resultado jsonb NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: evaluaciones_operativas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evaluaciones_operativas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evaluaciones_operativas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evaluaciones_operativas_id_seq OWNED BY public.evaluaciones_operativas.id;


--
-- Name: evidencias_servicio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evidencias_servicio (
    id integer NOT NULL,
    servicio_id integer NOT NULL,
    protocolo_id integer,
    personal_id integer NOT NULL,
    titulo character varying(150) NOT NULL,
    descripcion text,
    archivo_url text,
    estado_revision character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    observacion text,
    revisado_por integer,
    fecha_revision timestamp with time zone,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    turno_id integer,
    conforme boolean,
    CONSTRAINT evidencias_servicio_estado_revision_check CHECK (((estado_revision)::text = ANY ((ARRAY['pendiente'::character varying, 'aprobada'::character varying, 'observada'::character varying])::text[])))
);


--
-- Name: evidencias_servicio_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evidencias_servicio_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evidencias_servicio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evidencias_servicio_id_seq OWNED BY public.evidencias_servicio.id;


--
-- Name: importacion_filas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.importacion_filas (
    importacion_id uuid NOT NULL,
    fila integer NOT NULL,
    turno_id integer NOT NULL
);


--
-- Name: importaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.importaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    huella text NOT NULL,
    nombre text NOT NULL,
    usuario_id integer NOT NULL,
    datos jsonb NOT NULL,
    resultado jsonb,
    estado text DEFAULT 'preparado'::text NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    archivo bytea
);


--
-- Name: incidencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidencias (
    id integer NOT NULL,
    codigo character varying(10) NOT NULL,
    tipo_incidencia_id integer NOT NULL,
    servicio_id integer NOT NULL,
    personal_id integer,
    descripcion text,
    prioridad character varying(5) NOT NULL,
    estado character varying(12) DEFAULT 'abierta'::character varying NOT NULL,
    fecha_registro timestamp with time zone DEFAULT now() NOT NULL,
    fecha_atencion timestamp with time zone,
    fecha_cierre timestamp with time zone,
    observacion text,
    registrado_por integer NOT NULL,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    responsable_id integer,
    turno_id integer,
    sla_min integer,
    sla_resolucion_min integer,
    origen_plazo text DEFAULT 'historico'::text NOT NULL,
    evidencias jsonb DEFAULT '[]'::jsonb NOT NULL,
    plazo_resolucion_extendido timestamp with time zone,
    CONSTRAINT incidencias_estado_check CHECK (((estado)::text = ANY ((ARRAY['abierta'::character varying, 'en_atencion'::character varying, 'cerrada'::character varying])::text[]))),
    CONSTRAINT incidencias_evidencias_check CHECK ((jsonb_typeof(evidencias) = 'array'::text)),
    CONSTRAINT incidencias_prioridad_check CHECK (((prioridad)::text = ANY ((ARRAY['alta'::character varying, 'media'::character varying, 'baja'::character varying])::text[]))),
    CONSTRAINT incidencias_sla_min_check CHECK ((sla_min > 0)),
    CONSTRAINT incidencias_sla_resolucion_min_check CHECK ((sla_resolucion_min > 0))
);


--
-- Name: COLUMN incidencias.sla_resolucion_min; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incidencias.sla_resolucion_min IS 'Minutos desde fecha_registro hasta el vencimiento de resolución. NULL indica dato histórico desconocido.';


--
-- Name: incidencias_ampliaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidencias_ampliaciones (
    id bigint NOT NULL,
    incidencia_id integer NOT NULL,
    solicitado_por integer NOT NULL,
    solicitado_en timestamp with time zone DEFAULT now() NOT NULL,
    motivo text NOT NULL,
    evidencias jsonb DEFAULT '[]'::jsonb NOT NULL,
    plazo_anterior timestamp with time zone NOT NULL,
    plazo_solicitado timestamp with time zone NOT NULL,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    decidido_por integer,
    decidido_en timestamp with time zone,
    respuesta text,
    CONSTRAINT incidencias_ampliaciones_check CHECK ((plazo_solicitado > plazo_anterior)),
    CONSTRAINT incidencias_ampliaciones_check1 CHECK (((estado <> ALL (ARRAY['aprobada'::text, 'rechazada'::text])) OR ((decidido_por IS NOT NULL) AND (decidido_en IS NOT NULL) AND (length(TRIM(BOTH FROM respuesta)) >= 3)))),
    CONSTRAINT incidencias_ampliaciones_check2 CHECK (((decidido_por IS NULL) OR (decidido_por <> solicitado_por))),
    CONSTRAINT incidencias_ampliaciones_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'aprobada'::text, 'rechazada'::text, 'cancelada'::text]))),
    CONSTRAINT incidencias_ampliaciones_evidencias_check CHECK ((jsonb_typeof(evidencias) = 'array'::text)),
    CONSTRAINT incidencias_ampliaciones_motivo_check CHECK ((length(TRIM(BOTH FROM motivo)) >= 10))
);


--
-- Name: incidencias_ampliaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incidencias_ampliaciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incidencias_ampliaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incidencias_ampliaciones_id_seq OWNED BY public.incidencias_ampliaciones.id;


--
-- Name: incidencias_historial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidencias_historial (
    id bigint NOT NULL,
    incidencia_id integer NOT NULL,
    anterior jsonb,
    nuevo jsonb NOT NULL,
    usuario_id integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: incidencias_historial_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incidencias_historial_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incidencias_historial_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incidencias_historial_id_seq OWNED BY public.incidencias_historial.id;


--
-- Name: incidencias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incidencias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incidencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incidencias_id_seq OWNED BY public.incidencias.id;


--
-- Name: incidencias_seguimiento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidencias_seguimiento (
    id bigint NOT NULL,
    incidencia_id integer NOT NULL,
    accion text NOT NULL,
    comentario text NOT NULL,
    evidencias jsonb DEFAULT '[]'::jsonb NOT NULL,
    usuario_id integer NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT incidencias_seguimiento_accion_check CHECK ((accion = ANY (ARRAY['registrar'::text, 'atender'::text, 'avance'::text, 'resolver'::text, 'solicitar_ampliacion'::text, 'aprobar_ampliacion'::text, 'rechazar_ampliacion'::text]))),
    CONSTRAINT incidencias_seguimiento_evidencias_check CHECK ((jsonb_typeof(evidencias) = 'array'::text))
);


--
-- Name: incidencias_seguimiento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incidencias_seguimiento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incidencias_seguimiento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incidencias_seguimiento_id_seq OWNED BY public.incidencias_seguimiento.id;


--
-- Name: indicadores_bi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.indicadores_bi (
    codigo text NOT NULL,
    nombre text NOT NULL,
    unidad text NOT NULL,
    sentido text NOT NULL,
    formula text NOT NULL,
    CONSTRAINT indicadores_bi_sentido_check CHECK ((sentido = ANY (ARRAY['mayor'::text, 'menor'::text, 'informativo'::text]))),
    CONSTRAINT indicadores_bi_unidad_check CHECK ((unidad = ANY (ARRAY['%'::text, 'min'::text, 'cantidad'::text, 'por_1000'::text])))
);


--
-- Name: metas_bi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metas_bi (
    id bigint NOT NULL,
    codigo text NOT NULL,
    valor numeric,
    vigente_desde date NOT NULL,
    vigente_hasta date,
    actualizado_por integer,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT metas_bi_check CHECK (((vigente_hasta IS NULL) OR (vigente_hasta >= vigente_desde))),
    CONSTRAINT metas_bi_valor_check CHECK ((valor >= (0)::numeric))
);


--
-- Name: metas_bi_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.metas_bi_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: metas_bi_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.metas_bi_id_seq OWNED BY public.metas_bi.id;


--
-- Name: migraciones_aplicadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migraciones_aplicadas (
    nombre text NOT NULL,
    aplicado_en timestamp with time zone DEFAULT now()
);


--
-- Name: modelo_operativo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modelo_operativo (
    codigo text NOT NULL,
    nombre text NOT NULL,
    peso numeric NOT NULL,
    umbral numeric NOT NULL,
    CONSTRAINT modelo_operativo_peso_check CHECK (((peso >= (0)::numeric) AND (peso <= (1)::numeric))),
    CONSTRAINT modelo_operativo_umbral_check CHECK (((umbral > (0)::numeric) AND (umbral <= (100)::numeric)))
);


--
-- Name: obligaciones_operativas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.obligaciones_operativas (
    id integer NOT NULL,
    turno_id integer NOT NULL,
    tipo text NOT NULL,
    descripcion text NOT NULL,
    fecha_limite timestamp with time zone NOT NULL,
    fecha_completada timestamp with time zone,
    creado_por integer NOT NULL,
    completado_por integer,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    plantilla_id integer,
    secuencia integer DEFAULT 1 NOT NULL,
    resultado text,
    evidencia_url text,
    origen text DEFAULT 'manual'::text NOT NULL,
    evidencias jsonb DEFAULT '[]'::jsonb NOT NULL,
    estado_revision text DEFAULT 'pendiente'::text NOT NULL,
    revisado_por integer,
    fecha_revision timestamp with time zone,
    primera_entrega_en timestamp with time zone,
    version_entrega integer DEFAULT 1 NOT NULL,
    CONSTRAINT obligaciones_operativas_descripcion_check CHECK ((length(TRIM(BOTH FROM descripcion)) > 0)),
    CONSTRAINT obligaciones_operativas_estado_revision_check CHECK ((estado_revision = ANY (ARRAY['pendiente'::text, 'aprobado'::text, 'observado'::text]))),
    CONSTRAINT obligaciones_operativas_evidencias_check CHECK (((jsonb_typeof(evidencias) = 'array'::text) AND (jsonb_array_length(evidencias) <= 6))),
    CONSTRAINT obligaciones_operativas_tipo_check CHECK ((tipo = ANY (ARRAY['actividad'::text, 'reporte'::text]))),
    CONSTRAINT obligaciones_operativas_version_entrega_check CHECK ((version_entrega > 0))
);


--
-- Name: TABLE obligaciones_operativas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.obligaciones_operativas IS 'Una fila por actividad programada o reporte requerido. Exigible cuando fecha_limite <= corte; se excluyen anulados.';


--
-- Name: obligaciones_operativas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.obligaciones_operativas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: obligaciones_operativas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.obligaciones_operativas_id_seq OWNED BY public.obligaciones_operativas.id;


--
-- Name: personal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personal (
    id integer NOT NULL,
    nombres character varying(80) NOT NULL,
    apellidos character varying(80) NOT NULL,
    documento character varying(20) NOT NULL,
    cargo character varying(20) NOT NULL,
    estado character varying(10) DEFAULT 'activo'::character varying NOT NULL,
    correo character varying(120),
    sede_id integer NOT NULL,
    usuario_id integer,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    horario_inicio time without time zone,
    horario_fin time without time zone,
    dias_laborales integer[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6] NOT NULL,
    CONSTRAINT personal_cargo_check CHECK (((cargo)::text = ANY ((ARRAY['administrador'::character varying, 'jefe_operaciones'::character varying, 'supervisor'::character varying, 'agente'::character varying])::text[]))),
    CONSTRAINT personal_dias_validos CHECK ((dias_laborales <@ ARRAY[0, 1, 2, 3, 4, 5, 6])),
    CONSTRAINT personal_estado_check CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[]))),
    CONSTRAINT personal_horario_completo CHECK (((horario_inicio IS NULL) = (horario_fin IS NULL)))
);


--
-- Name: personal_ausencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personal_ausencias (
    id bigint NOT NULL,
    personal_id integer NOT NULL,
    inicio timestamp with time zone NOT NULL,
    fin timestamp with time zone NOT NULL,
    motivo text NOT NULL,
    creado_por integer NOT NULL,
    eliminado boolean DEFAULT false NOT NULL,
    CONSTRAINT personal_ausencias_check CHECK ((fin > inicio))
);


--
-- Name: personal_ausencias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.personal_ausencias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: personal_ausencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.personal_ausencias_id_seq OWNED BY public.personal_ausencias.id;


--
-- Name: personal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.personal_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: personal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.personal_id_seq OWNED BY public.personal.id;


--
-- Name: planes_operativos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planes_operativos (
    servicio_id integer NOT NULL,
    confirmado boolean DEFAULT false NOT NULL,
    actualizado_por integer,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plantillas_operativas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plantillas_operativas (
    id integer NOT NULL,
    servicio_id integer NOT NULL,
    tipo text NOT NULL,
    descripcion text NOT NULL,
    minutos_desde_inicio integer,
    intervalo_min integer,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plantillas_operativas_descripcion_check CHECK ((length(TRIM(BOTH FROM descripcion)) >= 3)),
    CONSTRAINT plantillas_operativas_intervalo_min_check CHECK (((intervalo_min >= 1) AND (intervalo_min <= 1440))),
    CONSTRAINT plantillas_operativas_minutos_desde_inicio_check CHECK (((minutos_desde_inicio >= 0) AND (minutos_desde_inicio <= 1440))),
    CONSTRAINT plantillas_operativas_tipo_check CHECK ((tipo = ANY (ARRAY['actividad'::text, 'ronda'::text, 'reporte'::text])))
);


--
-- Name: plantillas_operativas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plantillas_operativas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plantillas_operativas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plantillas_operativas_id_seq OWNED BY public.plantillas_operativas.id;


--
-- Name: protocolos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.protocolos (
    id integer NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(120) NOT NULL,
    descripcion text,
    actividades text,
    activo boolean DEFAULT true NOT NULL,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: protocolos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.protocolos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: protocolos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.protocolos_id_seq OWNED BY public.protocolos.id;


--
-- Name: reportes_generados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reportes_generados (
    id integer NOT NULL,
    tipo character varying(20) NOT NULL,
    categoria character varying(20) NOT NULL,
    formato character varying(5) NOT NULL,
    estado character varying(12) DEFAULT 'procesando'::character varying NOT NULL,
    generado_por integer NOT NULL,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reportes_generados_categoria_check CHECK (((categoria)::text = ANY ((ARRAY['operativos'::character varying, 'incidencias'::character varying, 'multicriterio'::character varying])::text[]))),
    CONSTRAINT reportes_generados_estado_check CHECK (((estado)::text = ANY ((ARRAY['completado'::character varying, 'procesando'::character varying, 'error'::character varying])::text[]))),
    CONSTRAINT reportes_generados_formato_check CHECK (((formato)::text = ANY ((ARRAY['xlsx'::character varying, 'pdf'::character varying])::text[]))),
    CONSTRAINT reportes_generados_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['servicios'::character varying, 'turnos'::character varying, 'incidencias'::character varying, 'bi'::character varying, 'multicriterio'::character varying])::text[])))
);


--
-- Name: reportes_generados_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reportes_generados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reportes_generados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reportes_generados_id_seq OWNED BY public.reportes_generados.id;


--
-- Name: revisiones_reportes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revisiones_reportes (
    id bigint NOT NULL,
    reporte_id integer NOT NULL,
    version_entrega integer NOT NULL,
    estado text NOT NULL,
    observacion text,
    revisado_por integer NOT NULL,
    revisado_en timestamp with time zone DEFAULT now() NOT NULL,
    fecha_entrega timestamp with time zone NOT NULL,
    contenido text,
    evidencias jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT revisiones_reportes_check CHECK (((estado <> 'observado'::text) OR (length(TRIM(BOTH FROM observacion)) >= 3))),
    CONSTRAINT revisiones_reportes_estado_check CHECK ((estado = ANY (ARRAY['aprobado'::text, 'observado'::text])))
);


--
-- Name: revisiones_reportes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.revisiones_reportes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: revisiones_reportes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.revisiones_reportes_id_seq OWNED BY public.revisiones_reportes.id;


--
-- Name: rondas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rondas (
    id integer NOT NULL,
    turno_id integer NOT NULL,
    servicio_id integer NOT NULL,
    fecha_programada timestamp with time zone NOT NULL,
    fecha_completada timestamp with time zone,
    ruta text,
    observaciones text,
    estado character varying(15) DEFAULT 'programada'::character varying NOT NULL,
    creado_por integer,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    plantilla_id integer,
    secuencia integer DEFAULT 1 NOT NULL,
    completado_por integer,
    origen text DEFAULT 'manual'::text NOT NULL,
    evidencias jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT rondas_estado_check CHECK (((estado)::text = ANY ((ARRAY['programada'::character varying, 'completada'::character varying, 'omitida'::character varying])::text[]))),
    CONSTRAINT rondas_evidencias_check CHECK (((jsonb_typeof(evidencias) = 'array'::text) AND (jsonb_array_length(evidencias) <= 6)))
);


--
-- Name: rondas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rondas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rondas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rondas_id_seq OWNED BY public.rondas.id;


--
-- Name: sedes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sedes (
    id integer NOT NULL,
    nombre character varying(120) NOT NULL,
    direccion text,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sedes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sedes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sedes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sedes_id_seq OWNED BY public.sedes.id;


--
-- Name: seq_incidencias; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_incidencias
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: servicio_contenedores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicio_contenedores (
    servicio_id integer NOT NULL,
    contenedor_id integer NOT NULL
);


--
-- Name: servicio_custodias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicio_custodias (
    servicio_id integer NOT NULL,
    cliente_almacen text,
    solicitante text,
    referencias text,
    transportista_id integer,
    origen_id integer,
    destino_id integer,
    hitos jsonb DEFAULT '{}'::jsonb NOT NULL,
    observacion text
);


--
-- Name: servicio_personal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicio_personal (
    id integer NOT NULL,
    servicio_id integer NOT NULL,
    personal_id integer NOT NULL,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: servicio_personal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.servicio_personal_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: servicio_personal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.servicio_personal_id_seq OWNED BY public.servicio_personal.id;


--
-- Name: servicio_protocolos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicio_protocolos (
    id integer NOT NULL,
    servicio_id integer NOT NULL,
    protocolo_id integer NOT NULL,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: servicio_protocolos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.servicio_protocolos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: servicio_protocolos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.servicio_protocolos_id_seq OWNED BY public.servicio_protocolos.id;


--
-- Name: servicio_requerimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicio_requerimientos (
    id integer NOT NULL,
    servicio_id integer NOT NULL,
    titulo character varying(150) NOT NULL,
    descripcion text,
    prioridad character varying(10) DEFAULT 'media'::character varying NOT NULL,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: servicio_requerimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.servicio_requerimientos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: servicio_requerimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.servicio_requerimientos_id_seq OWNED BY public.servicio_requerimientos.id;


--
-- Name: servicio_vehiculos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicio_vehiculos (
    servicio_id integer NOT NULL,
    vehiculo_id integer NOT NULL,
    papel text NOT NULL
);


--
-- Name: servicios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicios (
    id integer NOT NULL,
    nombre character varying(120) NOT NULL,
    cliente_id integer NOT NULL,
    sede_id integer NOT NULL,
    supervisor_id integer NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    estado character varying(15) DEFAULT 'programado'::character varying NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    codigo_externo text,
    CONSTRAINT servicios_estado_check CHECK (((estado)::text = ANY ((ARRAY['programado'::character varying, 'en_curso'::character varying, 'finalizado'::character varying])::text[])))
);


--
-- Name: servicios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.servicios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: servicios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.servicios_id_seq OWNED BY public.servicios.id;


--
-- Name: tipos_incidencia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipos_incidencia (
    id integer NOT NULL,
    nombre character varying(80) NOT NULL,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tipos_incidencia_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tipos_incidencia_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tipos_incidencia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tipos_incidencia_id_seq OWNED BY public.tipos_incidencia.id;


--
-- Name: transportistas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transportistas (
    id integer NOT NULL,
    nombre text NOT NULL
);


--
-- Name: transportistas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transportistas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transportistas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transportistas_id_seq OWNED BY public.transportistas.id;


--
-- Name: turnos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.turnos (
    id integer NOT NULL,
    personal_id integer,
    servicio_id integer NOT NULL,
    sede_id integer NOT NULL,
    fecha date NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    estado character varying(15) DEFAULT 'programado'::character varying NOT NULL,
    relevo_pendiente boolean DEFAULT false NOT NULL,
    creado_por integer,
    motivo_rechazo text,
    evidencias jsonb DEFAULT '[]'::jsonb NOT NULL,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    puesto text,
    ingreso_real timestamp with time zone,
    salida_real timestamp with time zone,
    asistencia_validada boolean DEFAULT false NOT NULL,
    tolerancia_min integer DEFAULT 10 NOT NULL,
    evidencias_requeridas integer,
    evidencias_registradas integer,
    evidencia_limite timestamp with time zone,
    evidencia_registro timestamp with time zone,
    funcion text,
    clave_importacion text,
    rondas_requeridas integer DEFAULT 0 NOT NULL,
    rondas_completadas integer DEFAULT 0 NOT NULL,
    plan_kpi_validado boolean DEFAULT false NOT NULL,
    CONSTRAINT turnos_estado_check CHECK (((estado)::text = ANY ((ARRAY['programado'::character varying, 'confirmado'::character varying, 'sin_confirmar'::character varying, 'cumplido'::character varying, 'pendiente'::character varying])::text[]))),
    CONSTRAINT turnos_evidencias_registradas_check CHECK ((evidencias_registradas >= 0)),
    CONSTRAINT turnos_evidencias_requeridas_check CHECK ((evidencias_requeridas >= 0)),
    CONSTRAINT turnos_tolerancia_min_check CHECK (((tolerancia_min >= 0) AND (tolerancia_min <= 120)))
);


--
-- Name: COLUMN turnos.plan_kpi_validado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.turnos.plan_kpi_validado IS 'Supervisión confirmó el inventario de actividades, rondas y reportes, incluso si no aplica ninguno.';


--
-- Name: turnos_historial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.turnos_historial (
    id bigint NOT NULL,
    turno_id integer NOT NULL,
    anterior jsonb,
    nuevo jsonb NOT NULL,
    usuario_id integer,
    motivo text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: turnos_historial_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.turnos_historial_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: turnos_historial_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.turnos_historial_id_seq OWNED BY public.turnos_historial.id;


--
-- Name: turnos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.turnos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: turnos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.turnos_id_seq OWNED BY public.turnos.id;


--
-- Name: ubicaciones_operativas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ubicaciones_operativas (
    id integer NOT NULL,
    nombre text NOT NULL
);


--
-- Name: ubicaciones_operativas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ubicaciones_operativas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ubicaciones_operativas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ubicaciones_operativas_id_seq OWNED BY public.ubicaciones_operativas.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nombre character varying(120) NOT NULL,
    correo character varying(120) NOT NULL,
    clave_hash text NOT NULL,
    rol character varying(20) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    debe_cambiar_clave boolean DEFAULT false NOT NULL,
    codigo_recuperacion character varying(30),
    recuperacion_expira timestamp with time zone,
    eliminado boolean DEFAULT false NOT NULL,
    eliminado_en timestamp with time zone,
    eliminado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT usuarios_rol_check CHECK (((rol)::text = ANY ((ARRAY['administrador'::character varying, 'jefe_operaciones'::character varying, 'supervisor'::character varying, 'operador'::character varying])::text[])))
);


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: vehiculos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehiculos (
    id integer NOT NULL,
    placa text NOT NULL
);


--
-- Name: vehiculos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vehiculos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vehiculos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vehiculos_id_seq OWNED BY public.vehiculos.id;


--
-- Name: verificaciones_consignas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verificaciones_consignas (
    id integer NOT NULL,
    turno_id integer NOT NULL,
    consigna_id integer NOT NULL,
    cumplida boolean NOT NULL,
    observacion text,
    verificado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: verificaciones_consignas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.verificaciones_consignas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: verificaciones_consignas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.verificaciones_consignas_id_seq OWNED BY public.verificaciones_consignas.id;


--
-- Name: vw_bi_cumplimiento_servicios; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_bi_cumplimiento_servicios AS
 SELECT date_trunc('month'::text, (s.fecha_inicio)::timestamp with time zone) AS mes,
    c.nombre AS cliente,
    count(*) AS total_servicios,
    count(*) FILTER (WHERE ((s.estado)::text = 'finalizado'::text)) AS servicios_finalizados,
    count(*) FILTER (WHERE ((s.estado)::text = ANY ((ARRAY['en_curso'::character varying, 'programado'::character varying])::text[]))) AS servicios_activos,
    round((((count(*) FILTER (WHERE ((s.estado)::text = 'finalizado'::text)))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS porcentaje_finalizados
   FROM (public.servicios s
     JOIN public.clientes c ON (((s.cliente_id = c.id) AND (c.eliminado = false))))
  WHERE (s.eliminado = false)
  GROUP BY (date_trunc('month'::text, (s.fecha_inicio)::timestamp with time zone)), c.nombre;


--
-- Name: vw_bi_cumplimiento_turnos; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_bi_cumplimiento_turnos AS
 SELECT date_trunc('week'::text, (t.fecha)::timestamp with time zone) AS semana,
    s.nombre AS servicio,
    c.nombre AS cliente,
    count(*) AS total_turnos,
    count(*) FILTER (WHERE ((t.estado)::text = 'cumplido'::text)) AS turnos_cumplidos,
    round((((count(*) FILTER (WHERE ((t.estado)::text = 'cumplido'::text)))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS porcentaje_cumplimiento
   FROM ((public.turnos t
     JOIN public.servicios s ON (((t.servicio_id = s.id) AND (s.eliminado = false))))
     JOIN public.clientes c ON (((s.cliente_id = c.id) AND (c.eliminado = false))))
  WHERE (t.eliminado = false)
  GROUP BY (date_trunc('week'::text, (t.fecha)::timestamp with time zone)), s.nombre, c.nombre;


--
-- Name: vw_bi_desempeno_servicio; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_bi_desempeno_servicio AS
 SELECT s.id AS servicio_id,
    s.nombre AS servicio,
    c.nombre AS cliente,
    round((((count(t.*) FILTER (WHERE ((t.estado)::text = 'cumplido'::text)))::numeric / (NULLIF(count(t.*) FILTER (WHERE (t.eliminado = false)), 0))::numeric) * (100)::numeric), 2) AS cumplimiento_turnos_pct,
    count(i.*) FILTER (WHERE ((i.eliminado = false) AND ((i.estado)::text <> 'cerrada'::text))) AS incidencias_abiertas,
    round(avg((EXTRACT(epoch FROM (i.fecha_atencion - i.fecha_registro)) / (60)::numeric)) FILTER (WHERE ((i.eliminado = false) AND (i.fecha_atencion IS NOT NULL))), 2) AS tiempo_promedio_atencion_min
   FROM (((public.servicios s
     JOIN public.clientes c ON (((s.cliente_id = c.id) AND (c.eliminado = false))))
     LEFT JOIN public.turnos t ON (((t.servicio_id = s.id) AND (t.eliminado = false))))
     LEFT JOIN public.incidencias i ON (((i.servicio_id = s.id) AND (i.eliminado = false))))
  WHERE (s.eliminado = false)
  GROUP BY s.id, s.nombre, c.nombre;


--
-- Name: vw_bi_evaluacion_multicriterio; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_bi_evaluacion_multicriterio AS
 SELECT em.id AS evaluacion_id,
    s.nombre AS servicio,
    c.nombre AS cliente,
    em.fecha_evaluacion,
    em.puntaje_global,
    em.nivel,
    array_agg(cm.nombre ORDER BY ec.puntaje) FILTER (WHERE (ec.influye = true)) AS criterios_que_influyen
   FROM ((((public.evaluaciones_multicriterio em
     JOIN public.servicios s ON (((s.id = em.servicio_id) AND (NOT s.eliminado))))
     JOIN public.clientes c ON (((c.id = s.cliente_id) AND (NOT c.eliminado))))
     JOIN public.evaluacion_criterios ec ON (((ec.evaluacion_id = em.id) AND (NOT ec.eliminado))))
     JOIN public.criterios_mcda cm ON (((cm.id = ec.criterio_id) AND (NOT cm.eliminado))))
  WHERE (NOT em.eliminado)
  GROUP BY em.id, s.id, s.nombre, c.nombre, em.fecha_evaluacion, em.puntaje_global, em.nivel;


--
-- Name: vw_bi_incidencias; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_bi_incidencias AS
 SELECT date_trunc('week'::text, i.fecha_registro) AS semana,
    s.nombre AS servicio,
    c.nombre AS cliente,
    i.prioridad,
    i.estado,
    count(*) AS cantidad,
    round(avg((EXTRACT(epoch FROM (COALESCE(i.fecha_atencion, now()) - i.fecha_registro)) / (60)::numeric)), 2) AS tiempo_promedio_atencion_min
   FROM ((public.incidencias i
     JOIN public.servicios s ON (((i.servicio_id = s.id) AND (s.eliminado = false))))
     JOIN public.clientes c ON (((s.cliente_id = c.id) AND (c.eliminado = false))))
  WHERE (i.eliminado = false)
  GROUP BY (date_trunc('week'::text, i.fecha_registro)), s.nombre, c.nombre, i.prioridad, i.estado;


--
-- Name: vw_bi_incidencias_por_tipo; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_bi_incidencias_por_tipo AS
 SELECT ti.nombre AS tipo,
    count(*) AS cantidad,
    count(*) FILTER (WHERE ((i.estado)::text = 'cerrada'::text)) AS cerradas,
    count(*) FILTER (WHERE ((i.estado)::text = 'abierta'::text)) AS abiertas,
    count(*) FILTER (WHERE ((i.estado)::text = 'en_atencion'::text)) AS en_atencion
   FROM (public.incidencias i
     JOIN public.tipos_incidencia ti ON (((i.tipo_incidencia_id = ti.id) AND (ti.eliminado = false))))
  WHERE (i.eliminado = false)
  GROUP BY ti.nombre
  ORDER BY (count(*)) DESC;


--
-- Name: vw_bi_kpi_consignas; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_bi_kpi_consignas AS
 SELECT s.id AS servicio_id,
    s.nombre AS servicio,
    c.nombre AS cliente,
    date_trunc('week'::text, vc.creado_en) AS semana,
    count(*) AS verificaciones_realizadas,
    count(*) FILTER (WHERE (vc.cumplida = true)) AS consignas_cumplidas,
    round((((count(*) FILTER (WHERE (vc.cumplida = true)))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS kpi04_consignas_pct
   FROM ((((public.verificaciones_consignas vc
     JOIN public.turnos t ON (((t.id = vc.turno_id) AND (NOT t.eliminado))))
     JOIN public.consignas cn ON (((cn.servicio_id = t.servicio_id) AND (vc.consigna_id = cn.id) AND (cn.eliminado = false))))
     JOIN public.servicios s ON (((cn.servicio_id = s.id) AND (s.eliminado = false))))
     JOIN public.clientes c ON (((s.cliente_id = c.id) AND (c.eliminado = false))))
  WHERE (vc.creado_en <= now())
  GROUP BY s.id, s.nombre, c.nombre, (date_trunc('week'::text, vc.creado_en));


--
-- Name: vw_bi_kpi_rondas; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_bi_kpi_rondas AS
 SELECT s.id AS servicio_id,
    s.nombre AS servicio,
    c.nombre AS cliente,
    date_trunc('week'::text, r.fecha_programada) AS semana,
    count(*) AS rondas_programadas,
    count(*) FILTER (WHERE (((r.estado)::text = 'completada'::text) AND (r.fecha_completada <= now()))) AS rondas_completadas,
    count(*) FILTER (WHERE ((r.estado)::text = 'omitida'::text)) AS rondas_omitidas,
    round((((count(*) FILTER (WHERE ((r.estado)::text = 'completada'::text)))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS kpi06_rondas_pct
   FROM ((public.rondas r
     JOIN public.servicios s ON (((r.servicio_id = s.id) AND (s.eliminado = false))))
     JOIN public.clientes c ON (((s.cliente_id = c.id) AND (c.eliminado = false))))
  WHERE ((r.eliminado = false) AND (r.fecha_programada <= now()))
  GROUP BY s.id, s.nombre, c.nombre, (date_trunc('week'::text, r.fecha_programada));


--
-- Name: vw_bi_kpis_operativos; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_bi_kpis_operativos AS
 SELECT e.id AS evaluacion_id,
    e.servicio_id,
    e.version,
    e.creado_en,
    e.filtros,
    (c.value ->> 'codigo'::text) AS criterio,
    (c.value ->> 'nombre'::text) AS nombre,
    (c.value ->> 'estado'::text) AS estado,
    ((c.value ->> 'tasa'::text))::numeric AS cumplimiento,
    ((c.value ->> 'riesgo'::text))::numeric AS riesgo,
    ((c.value ->> 'peso'::text))::numeric AS peso,
    ((c.value ->> 'umbral'::text))::numeric AS umbral,
    ((c.value ->> 'aporte'::text))::numeric AS aporte,
    ((e.resultado ->> 'criticidad'::text))::numeric AS criticidad,
    (c.value -> 'kpi01'::text) AS primer_kpi,
    (c.value -> 'kpi02'::text) AS segundo_kpi
   FROM (public.evaluaciones_operativas e
     CROSS JOIN LATERAL jsonb_array_elements((e.resultado -> 'criterios'::text)) c(value))
  WHERE (e.version = 'operativo-v4'::text);


--
-- Name: vw_operacion_turnos; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_operacion_turnos AS
 SELECT id,
    personal_id,
    servicio_id,
    sede_id,
    fecha,
    hora_inicio,
    hora_fin,
    estado,
    relevo_pendiente,
    creado_por,
    motivo_rechazo,
    evidencias,
    eliminado,
    eliminado_en,
    eliminado_por,
    creado_en,
    actualizado_en,
    puesto,
    ingreso_real,
    salida_real,
    asistencia_validada,
    tolerancia_min,
    evidencias_requeridas,
    evidencias_registradas,
    evidencia_limite,
    evidencia_registro,
    funcion,
    clave_importacion,
    ((fecha + hora_inicio) AT TIME ZONE 'America/Lima'::text) AS inicio_programado,
    (((fecha + hora_fin) +
        CASE
            WHEN (hora_fin <= hora_inicio) THEN '1 day'::interval
            ELSE '00:00:00'::interval
        END) AT TIME ZONE 'America/Lima'::text) AS fin_programado,
    ( SELECT (count(*))::integer AS count
           FROM public.evidencias_servicio e
          WHERE ((e.turno_id = t.id) AND (NOT e.eliminado))) AS evidencias_vinculadas,
    ( SELECT (count(*))::integer AS count
           FROM public.evidencias_servicio e
          WHERE ((e.turno_id = t.id) AND (NOT e.eliminado) AND (e.creado_en <= t.evidencia_limite))) AS evidencias_vinculadas_en_plazo
   FROM public.turnos t
  WHERE (NOT eliminado);


--
-- Name: cargas id; Type: DEFAULT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.cargas ALTER COLUMN id SET DEFAULT nextval('bi.cargas_id_seq'::regclass);


--
-- Name: dim_cliente sk; Type: DEFAULT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_cliente ALTER COLUMN sk SET DEFAULT nextval('dw.dim_cliente_sk_seq'::regclass);


--
-- Name: dim_indicador sk; Type: DEFAULT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_indicador ALTER COLUMN sk SET DEFAULT nextval('dw.dim_indicador_sk_seq'::regclass);


--
-- Name: dim_personal sk; Type: DEFAULT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_personal ALTER COLUMN sk SET DEFAULT nextval('dw.dim_personal_sk_seq'::regclass);


--
-- Name: dim_sede sk; Type: DEFAULT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_sede ALTER COLUMN sk SET DEFAULT nextval('dw.dim_sede_sk_seq'::regclass);


--
-- Name: dim_servicio sk; Type: DEFAULT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_servicio ALTER COLUMN sk SET DEFAULT nextval('dw.dim_servicio_sk_seq'::regclass);


--
-- Name: dim_supervisor sk; Type: DEFAULT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_supervisor ALTER COLUMN sk SET DEFAULT nextval('dw.dim_supervisor_sk_seq'::regclass);


--
-- Name: dim_tipo_incidencia sk; Type: DEFAULT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_tipo_incidencia ALTER COLUMN sk SET DEFAULT nextval('dw.dim_tipo_incidencia_sk_seq'::regclass);


--
-- Name: fact_incidencia sk; Type: DEFAULT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_incidencia ALTER COLUMN sk SET DEFAULT nextval('dw.fact_incidencia_sk_seq'::regclass);


--
-- Name: fact_meta sk; Type: DEFAULT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_meta ALTER COLUMN sk SET DEFAULT nextval('dw.fact_meta_sk_seq'::regclass);


--
-- Name: fact_obligacion sk; Type: DEFAULT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_obligacion ALTER COLUMN sk SET DEFAULT nextval('dw.fact_obligacion_sk_seq'::regclass);


--
-- Name: fact_ronda sk; Type: DEFAULT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_ronda ALTER COLUMN sk SET DEFAULT nextval('dw.fact_ronda_sk_seq'::regclass);


--
-- Name: fact_servicio_diario sk; Type: DEFAULT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_servicio_diario ALTER COLUMN sk SET DEFAULT nextval('dw.fact_servicio_diario_sk_seq'::regclass);


--
-- Name: fact_turno sk; Type: DEFAULT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_turno ALTER COLUMN sk SET DEFAULT nextval('dw.fact_turno_sk_seq'::regclass);


--
-- Name: ejecuciones id; Type: DEFAULT; Schema: etl; Owner: -
--

ALTER TABLE ONLY etl.ejecuciones ALTER COLUMN id SET DEFAULT nextval('etl.ejecuciones_id_seq'::regclass);


--
-- Name: actividad_reciente id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividad_reciente ALTER COLUMN id SET DEFAULT nextval('public.actividad_reciente_id_seq'::regclass);


--
-- Name: clientes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes ALTER COLUMN id SET DEFAULT nextval('public.clientes_id_seq'::regclass);


--
-- Name: consignas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consignas ALTER COLUMN id SET DEFAULT nextval('public.consignas_id_seq'::regclass);


--
-- Name: contenedores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedores ALTER COLUMN id SET DEFAULT nextval('public.contenedores_id_seq'::regclass);


--
-- Name: criterios_mcda id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.criterios_mcda ALTER COLUMN id SET DEFAULT nextval('public.criterios_mcda_id_seq'::regclass);


--
-- Name: evaluacion_criterios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluacion_criterios ALTER COLUMN id SET DEFAULT nextval('public.evaluacion_criterios_id_seq'::regclass);


--
-- Name: evaluaciones_multicriterio id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones_multicriterio ALTER COLUMN id SET DEFAULT nextval('public.evaluaciones_multicriterio_id_seq'::regclass);


--
-- Name: evaluaciones_operativas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones_operativas ALTER COLUMN id SET DEFAULT nextval('public.evaluaciones_operativas_id_seq'::regclass);


--
-- Name: evidencias_servicio id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencias_servicio ALTER COLUMN id SET DEFAULT nextval('public.evidencias_servicio_id_seq'::regclass);


--
-- Name: incidencias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias ALTER COLUMN id SET DEFAULT nextval('public.incidencias_id_seq'::regclass);


--
-- Name: incidencias_ampliaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias_ampliaciones ALTER COLUMN id SET DEFAULT nextval('public.incidencias_ampliaciones_id_seq'::regclass);


--
-- Name: incidencias_historial id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias_historial ALTER COLUMN id SET DEFAULT nextval('public.incidencias_historial_id_seq'::regclass);


--
-- Name: incidencias_seguimiento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias_seguimiento ALTER COLUMN id SET DEFAULT nextval('public.incidencias_seguimiento_id_seq'::regclass);


--
-- Name: metas_bi id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas_bi ALTER COLUMN id SET DEFAULT nextval('public.metas_bi_id_seq'::regclass);


--
-- Name: obligaciones_operativas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligaciones_operativas ALTER COLUMN id SET DEFAULT nextval('public.obligaciones_operativas_id_seq'::regclass);


--
-- Name: personal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal ALTER COLUMN id SET DEFAULT nextval('public.personal_id_seq'::regclass);


--
-- Name: personal_ausencias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_ausencias ALTER COLUMN id SET DEFAULT nextval('public.personal_ausencias_id_seq'::regclass);


--
-- Name: plantillas_operativas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas_operativas ALTER COLUMN id SET DEFAULT nextval('public.plantillas_operativas_id_seq'::regclass);


--
-- Name: protocolos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocolos ALTER COLUMN id SET DEFAULT nextval('public.protocolos_id_seq'::regclass);


--
-- Name: reportes_generados id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes_generados ALTER COLUMN id SET DEFAULT nextval('public.reportes_generados_id_seq'::regclass);


--
-- Name: revisiones_reportes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_reportes ALTER COLUMN id SET DEFAULT nextval('public.revisiones_reportes_id_seq'::regclass);


--
-- Name: rondas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rondas ALTER COLUMN id SET DEFAULT nextval('public.rondas_id_seq'::regclass);


--
-- Name: sedes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sedes ALTER COLUMN id SET DEFAULT nextval('public.sedes_id_seq'::regclass);


--
-- Name: servicio_personal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_personal ALTER COLUMN id SET DEFAULT nextval('public.servicio_personal_id_seq'::regclass);


--
-- Name: servicio_protocolos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_protocolos ALTER COLUMN id SET DEFAULT nextval('public.servicio_protocolos_id_seq'::regclass);


--
-- Name: servicio_requerimientos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_requerimientos ALTER COLUMN id SET DEFAULT nextval('public.servicio_requerimientos_id_seq'::regclass);


--
-- Name: servicios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios ALTER COLUMN id SET DEFAULT nextval('public.servicios_id_seq'::regclass);


--
-- Name: tipos_incidencia id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_incidencia ALTER COLUMN id SET DEFAULT nextval('public.tipos_incidencia_id_seq'::regclass);


--
-- Name: transportistas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transportistas ALTER COLUMN id SET DEFAULT nextval('public.transportistas_id_seq'::regclass);


--
-- Name: turnos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos ALTER COLUMN id SET DEFAULT nextval('public.turnos_id_seq'::regclass);


--
-- Name: turnos_historial id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos_historial ALTER COLUMN id SET DEFAULT nextval('public.turnos_historial_id_seq'::regclass);


--
-- Name: ubicaciones_operativas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubicaciones_operativas ALTER COLUMN id SET DEFAULT nextval('public.ubicaciones_operativas_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: vehiculos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculos ALTER COLUMN id SET DEFAULT nextval('public.vehiculos_id_seq'::regclass);


--
-- Name: verificaciones_consignas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verificaciones_consignas ALTER COLUMN id SET DEFAULT nextval('public.verificaciones_consignas_id_seq'::regclass);


--
-- Name: cargas cargas_pkey; Type: CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.cargas
    ADD CONSTRAINT cargas_pkey PRIMARY KEY (id);


--
-- Name: dim_cliente dim_cliente_pkey; Type: CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.dim_cliente
    ADD CONSTRAINT dim_cliente_pkey PRIMARY KEY (id);


--
-- Name: dim_fecha dim_fecha_pkey; Type: CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.dim_fecha
    ADD CONSTRAINT dim_fecha_pkey PRIMARY KEY (fecha);


--
-- Name: dim_personal dim_personal_pkey; Type: CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.dim_personal
    ADD CONSTRAINT dim_personal_pkey PRIMARY KEY (id);


--
-- Name: dim_sede dim_sede_pkey; Type: CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.dim_sede
    ADD CONSTRAINT dim_sede_pkey PRIMARY KEY (id);


--
-- Name: dim_servicio dim_servicio_pkey; Type: CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.dim_servicio
    ADD CONSTRAINT dim_servicio_pkey PRIMARY KEY (id);


--
-- Name: hecho_evidencia hecho_evidencia_pkey; Type: CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.hecho_evidencia
    ADD CONSTRAINT hecho_evidencia_pkey PRIMARY KEY (turno_id);


--
-- Name: hecho_incidencia hecho_incidencia_pkey; Type: CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.hecho_incidencia
    ADD CONSTRAINT hecho_incidencia_pkey PRIMARY KEY (id);


--
-- Name: hecho_turno hecho_turno_pkey; Type: CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.hecho_turno
    ADD CONSTRAINT hecho_turno_pkey PRIMARY KEY (id);


--
-- Name: dim_cliente dim_cliente_pkey; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_cliente
    ADD CONSTRAINT dim_cliente_pkey PRIMARY KEY (sk);


--
-- Name: dim_fecha dim_fecha_fecha_key; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_fecha
    ADD CONSTRAINT dim_fecha_fecha_key UNIQUE (fecha);


--
-- Name: dim_fecha dim_fecha_pkey; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_fecha
    ADD CONSTRAINT dim_fecha_pkey PRIMARY KEY (fecha_sk);


--
-- Name: dim_indicador dim_indicador_codigo_key; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_indicador
    ADD CONSTRAINT dim_indicador_codigo_key UNIQUE (codigo);


--
-- Name: dim_indicador dim_indicador_pkey; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_indicador
    ADD CONSTRAINT dim_indicador_pkey PRIMARY KEY (sk);


--
-- Name: dim_personal dim_personal_pkey; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_personal
    ADD CONSTRAINT dim_personal_pkey PRIMARY KEY (sk);


--
-- Name: dim_sede dim_sede_pkey; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_sede
    ADD CONSTRAINT dim_sede_pkey PRIMARY KEY (sk);


--
-- Name: dim_servicio dim_servicio_pkey; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_servicio
    ADD CONSTRAINT dim_servicio_pkey PRIMARY KEY (sk);


--
-- Name: dim_supervisor dim_supervisor_pkey; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_supervisor
    ADD CONSTRAINT dim_supervisor_pkey PRIMARY KEY (sk);


--
-- Name: dim_tipo_incidencia dim_tipo_incidencia_origen_id_key; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_tipo_incidencia
    ADD CONSTRAINT dim_tipo_incidencia_origen_id_key UNIQUE (origen_id);


--
-- Name: dim_tipo_incidencia dim_tipo_incidencia_pkey; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_tipo_incidencia
    ADD CONSTRAINT dim_tipo_incidencia_pkey PRIMARY KEY (sk);


--
-- Name: dim_tipo_obligacion dim_tipo_obligacion_nombre_key; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_tipo_obligacion
    ADD CONSTRAINT dim_tipo_obligacion_nombre_key UNIQUE (nombre);


--
-- Name: dim_tipo_obligacion dim_tipo_obligacion_pkey; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.dim_tipo_obligacion
    ADD CONSTRAINT dim_tipo_obligacion_pkey PRIMARY KEY (sk);


--
-- Name: fact_incidencia fact_incidencia_incidencia_origen_id_key; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_incidencia
    ADD CONSTRAINT fact_incidencia_incidencia_origen_id_key UNIQUE (incidencia_origen_id);


--
-- Name: fact_incidencia fact_incidencia_pkey; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_incidencia
    ADD CONSTRAINT fact_incidencia_pkey PRIMARY KEY (sk);


--
-- Name: fact_meta fact_meta_indicador_sk_vigente_desde_key; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_meta
    ADD CONSTRAINT fact_meta_indicador_sk_vigente_desde_key UNIQUE (indicador_sk, vigente_desde);


--
-- Name: fact_meta fact_meta_pkey; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_meta
    ADD CONSTRAINT fact_meta_pkey PRIMARY KEY (sk);


--
-- Name: fact_obligacion fact_obligacion_obligacion_origen_id_key; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_obligacion
    ADD CONSTRAINT fact_obligacion_obligacion_origen_id_key UNIQUE (obligacion_origen_id);


--
-- Name: fact_obligacion fact_obligacion_pkey; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_obligacion
    ADD CONSTRAINT fact_obligacion_pkey PRIMARY KEY (sk);


--
-- Name: fact_ronda fact_ronda_pkey; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_ronda
    ADD CONSTRAINT fact_ronda_pkey PRIMARY KEY (sk);


--
-- Name: fact_ronda fact_ronda_ronda_origen_id_key; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_ronda
    ADD CONSTRAINT fact_ronda_ronda_origen_id_key UNIQUE (ronda_origen_id);


--
-- Name: fact_servicio_diario fact_servicio_diario_pkey; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_servicio_diario
    ADD CONSTRAINT fact_servicio_diario_pkey PRIMARY KEY (sk);


--
-- Name: fact_servicio_diario fact_servicio_diario_servicio_origen_id_fecha_sk_key; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_servicio_diario
    ADD CONSTRAINT fact_servicio_diario_servicio_origen_id_fecha_sk_key UNIQUE (servicio_origen_id, fecha_sk);


--
-- Name: fact_turno fact_turno_pkey; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_turno
    ADD CONSTRAINT fact_turno_pkey PRIMARY KEY (sk);


--
-- Name: fact_turno fact_turno_turno_origen_id_key; Type: CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_turno
    ADD CONSTRAINT fact_turno_turno_origen_id_key UNIQUE (turno_origen_id);


--
-- Name: ejecuciones ejecuciones_pkey; Type: CONSTRAINT; Schema: etl; Owner: -
--

ALTER TABLE ONLY etl.ejecuciones
    ADD CONSTRAINT ejecuciones_pkey PRIMARY KEY (id);


--
-- Name: estado estado_pkey; Type: CONSTRAINT; Schema: etl; Owner: -
--

ALTER TABLE ONLY etl.estado
    ADD CONSTRAINT estado_pkey PRIMARY KEY (id);


--
-- Name: actividad_reciente actividad_reciente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividad_reciente
    ADD CONSTRAINT actividad_reciente_pkey PRIMARY KEY (id);


--
-- Name: incidencias chk_inc_atencion_orden; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.incidencias
    ADD CONSTRAINT chk_inc_atencion_orden CHECK (((fecha_atencion IS NULL) OR (fecha_atencion >= fecha_registro))) NOT VALID;


--
-- Name: turnos chk_turno_asistencia_orden; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.turnos
    ADD CONSTRAINT chk_turno_asistencia_orden CHECK (((salida_real IS NULL) OR ((ingreso_real IS NOT NULL) AND (salida_real > ingreso_real)))) NOT VALID;


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: configuracion_operativa configuracion_operativa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_operativa
    ADD CONSTRAINT configuracion_operativa_pkey PRIMARY KEY (id);


--
-- Name: consignas consignas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consignas
    ADD CONSTRAINT consignas_pkey PRIMARY KEY (id);


--
-- Name: contenedores contenedores_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedores
    ADD CONSTRAINT contenedores_codigo_key UNIQUE (codigo);


--
-- Name: contenedores contenedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedores
    ADD CONSTRAINT contenedores_pkey PRIMARY KEY (id);


--
-- Name: criterios_mcda criterios_mcda_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.criterios_mcda
    ADD CONSTRAINT criterios_mcda_codigo_key UNIQUE (codigo);


--
-- Name: criterios_mcda criterios_mcda_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.criterios_mcda
    ADD CONSTRAINT criterios_mcda_pkey PRIMARY KEY (id);


--
-- Name: evaluacion_criterios evaluacion_criterios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluacion_criterios
    ADD CONSTRAINT evaluacion_criterios_pkey PRIMARY KEY (id);


--
-- Name: evaluaciones_multicriterio evaluaciones_multicriterio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones_multicriterio
    ADD CONSTRAINT evaluaciones_multicriterio_pkey PRIMARY KEY (id);


--
-- Name: evaluaciones_operativas evaluaciones_operativas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones_operativas
    ADD CONSTRAINT evaluaciones_operativas_pkey PRIMARY KEY (id);


--
-- Name: evidencias_servicio evidencias_servicio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencias_servicio
    ADD CONSTRAINT evidencias_servicio_pkey PRIMARY KEY (id);


--
-- Name: importacion_filas importacion_filas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.importacion_filas
    ADD CONSTRAINT importacion_filas_pkey PRIMARY KEY (importacion_id, fila);


--
-- Name: importacion_filas importacion_filas_turno_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.importacion_filas
    ADD CONSTRAINT importacion_filas_turno_id_key UNIQUE (turno_id);


--
-- Name: importaciones importaciones_huella_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.importaciones
    ADD CONSTRAINT importaciones_huella_key UNIQUE (huella);


--
-- Name: importaciones importaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.importaciones
    ADD CONSTRAINT importaciones_pkey PRIMARY KEY (id);


--
-- Name: incidencias_ampliaciones incidencias_ampliaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias_ampliaciones
    ADD CONSTRAINT incidencias_ampliaciones_pkey PRIMARY KEY (id);


--
-- Name: incidencias_historial incidencias_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias_historial
    ADD CONSTRAINT incidencias_historial_pkey PRIMARY KEY (id);


--
-- Name: incidencias incidencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_pkey PRIMARY KEY (id);


--
-- Name: incidencias_seguimiento incidencias_seguimiento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias_seguimiento
    ADD CONSTRAINT incidencias_seguimiento_pkey PRIMARY KEY (id);


--
-- Name: indicadores_bi indicadores_bi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indicadores_bi
    ADD CONSTRAINT indicadores_bi_pkey PRIMARY KEY (codigo);


--
-- Name: metas_bi metas_bi_codigo_vigente_desde_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas_bi
    ADD CONSTRAINT metas_bi_codigo_vigente_desde_key UNIQUE (codigo, vigente_desde);


--
-- Name: metas_bi metas_bi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas_bi
    ADD CONSTRAINT metas_bi_pkey PRIMARY KEY (id);


--
-- Name: migraciones_aplicadas migraciones_aplicadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migraciones_aplicadas
    ADD CONSTRAINT migraciones_aplicadas_pkey PRIMARY KEY (nombre);


--
-- Name: modelo_operativo modelo_operativo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modelo_operativo
    ADD CONSTRAINT modelo_operativo_pkey PRIMARY KEY (codigo);


--
-- Name: obligaciones_operativas obligaciones_operativas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligaciones_operativas
    ADD CONSTRAINT obligaciones_operativas_pkey PRIMARY KEY (id);


--
-- Name: personal_ausencias personal_ausencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_ausencias
    ADD CONSTRAINT personal_ausencias_pkey PRIMARY KEY (id);


--
-- Name: personal personal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal
    ADD CONSTRAINT personal_pkey PRIMARY KEY (id);


--
-- Name: planes_operativos planes_operativos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planes_operativos
    ADD CONSTRAINT planes_operativos_pkey PRIMARY KEY (servicio_id);


--
-- Name: plantillas_operativas plantillas_operativas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas_operativas
    ADD CONSTRAINT plantillas_operativas_pkey PRIMARY KEY (id);


--
-- Name: protocolos protocolos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocolos
    ADD CONSTRAINT protocolos_pkey PRIMARY KEY (id);


--
-- Name: reportes_generados reportes_generados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes_generados
    ADD CONSTRAINT reportes_generados_pkey PRIMARY KEY (id);


--
-- Name: revisiones_reportes revisiones_reportes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_reportes
    ADD CONSTRAINT revisiones_reportes_pkey PRIMARY KEY (id);


--
-- Name: revisiones_reportes revisiones_reportes_reporte_id_version_entrega_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_reportes
    ADD CONSTRAINT revisiones_reportes_reporte_id_version_entrega_key UNIQUE (reporte_id, version_entrega);


--
-- Name: rondas rondas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rondas
    ADD CONSTRAINT rondas_pkey PRIMARY KEY (id);


--
-- Name: sedes sedes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sedes
    ADD CONSTRAINT sedes_pkey PRIMARY KEY (id);


--
-- Name: servicio_contenedores servicio_contenedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_contenedores
    ADD CONSTRAINT servicio_contenedores_pkey PRIMARY KEY (servicio_id, contenedor_id);


--
-- Name: servicio_custodias servicio_custodias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_custodias
    ADD CONSTRAINT servicio_custodias_pkey PRIMARY KEY (servicio_id);


--
-- Name: servicio_personal servicio_personal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_personal
    ADD CONSTRAINT servicio_personal_pkey PRIMARY KEY (id);


--
-- Name: servicio_protocolos servicio_protocolos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_protocolos
    ADD CONSTRAINT servicio_protocolos_pkey PRIMARY KEY (id);


--
-- Name: servicio_requerimientos servicio_requerimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_requerimientos
    ADD CONSTRAINT servicio_requerimientos_pkey PRIMARY KEY (id);


--
-- Name: servicio_vehiculos servicio_vehiculos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_vehiculos
    ADD CONSTRAINT servicio_vehiculos_pkey PRIMARY KEY (servicio_id, vehiculo_id, papel);


--
-- Name: servicios servicios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_pkey PRIMARY KEY (id);


--
-- Name: tipos_incidencia tipos_incidencia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_incidencia
    ADD CONSTRAINT tipos_incidencia_pkey PRIMARY KEY (id);


--
-- Name: transportistas transportistas_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transportistas
    ADD CONSTRAINT transportistas_nombre_key UNIQUE (nombre);


--
-- Name: transportistas transportistas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transportistas
    ADD CONSTRAINT transportistas_pkey PRIMARY KEY (id);


--
-- Name: turnos_historial turnos_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos_historial
    ADD CONSTRAINT turnos_historial_pkey PRIMARY KEY (id);


--
-- Name: turnos turnos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos
    ADD CONSTRAINT turnos_pkey PRIMARY KEY (id);


--
-- Name: ubicaciones_operativas ubicaciones_operativas_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubicaciones_operativas
    ADD CONSTRAINT ubicaciones_operativas_nombre_key UNIQUE (nombre);


--
-- Name: ubicaciones_operativas ubicaciones_operativas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubicaciones_operativas
    ADD CONSTRAINT ubicaciones_operativas_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_correo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_correo_key UNIQUE (correo);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: vehiculos vehiculos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculos
    ADD CONSTRAINT vehiculos_pkey PRIMARY KEY (id);


--
-- Name: vehiculos vehiculos_placa_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculos
    ADD CONSTRAINT vehiculos_placa_key UNIQUE (placa);


--
-- Name: verificaciones_consignas verificaciones_consignas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verificaciones_consignas
    ADD CONSTRAINT verificaciones_consignas_pkey PRIMARY KEY (id);


--
-- Name: dim_cliente_actual; Type: INDEX; Schema: dw; Owner: -
--

CREATE UNIQUE INDEX dim_cliente_actual ON dw.dim_cliente USING btree (origen_id) WHERE actual;


--
-- Name: dim_cliente_version; Type: INDEX; Schema: dw; Owner: -
--

CREATE INDEX dim_cliente_version ON dw.dim_cliente USING btree (origen_id, vigente_desde, vigente_hasta);


--
-- Name: dim_personal_actual; Type: INDEX; Schema: dw; Owner: -
--

CREATE UNIQUE INDEX dim_personal_actual ON dw.dim_personal USING btree (origen_id) WHERE actual;


--
-- Name: dim_personal_version; Type: INDEX; Schema: dw; Owner: -
--

CREATE INDEX dim_personal_version ON dw.dim_personal USING btree (origen_id, vigente_desde, vigente_hasta);


--
-- Name: dim_sede_actual; Type: INDEX; Schema: dw; Owner: -
--

CREATE UNIQUE INDEX dim_sede_actual ON dw.dim_sede USING btree (origen_id) WHERE actual;


--
-- Name: dim_sede_version; Type: INDEX; Schema: dw; Owner: -
--

CREATE INDEX dim_sede_version ON dw.dim_sede USING btree (origen_id, vigente_desde, vigente_hasta);


--
-- Name: dim_servicio_actual; Type: INDEX; Schema: dw; Owner: -
--

CREATE UNIQUE INDEX dim_servicio_actual ON dw.dim_servicio USING btree (origen_id) WHERE actual;


--
-- Name: dim_servicio_version; Type: INDEX; Schema: dw; Owner: -
--

CREATE INDEX dim_servicio_version ON dw.dim_servicio USING btree (origen_id, vigente_desde, vigente_hasta);


--
-- Name: dim_supervisor_actual; Type: INDEX; Schema: dw; Owner: -
--

CREATE UNIQUE INDEX dim_supervisor_actual ON dw.dim_supervisor USING btree (origen_id) WHERE actual;


--
-- Name: dim_supervisor_version; Type: INDEX; Schema: dw; Owner: -
--

CREATE INDEX dim_supervisor_version ON dw.dim_supervisor USING btree (origen_id, vigente_desde, vigente_hasta);


--
-- Name: fact_incidencia_filtros; Type: INDEX; Schema: dw; Owner: -
--

CREATE INDEX fact_incidencia_filtros ON dw.fact_incidencia USING btree (fecha_sk, servicio_sk, cliente_sk, sede_sk, supervisor_sk);


--
-- Name: fact_obligacion_filtros; Type: INDEX; Schema: dw; Owner: -
--

CREATE INDEX fact_obligacion_filtros ON dw.fact_obligacion USING btree (fecha_sk, servicio_sk, cliente_sk, sede_sk, supervisor_sk);


--
-- Name: fact_ronda_filtros; Type: INDEX; Schema: dw; Owner: -
--

CREATE INDEX fact_ronda_filtros ON dw.fact_ronda USING btree (fecha_sk, servicio_sk, cliente_sk, sede_sk, supervisor_sk);


--
-- Name: fact_servicio_diario_filtros; Type: INDEX; Schema: dw; Owner: -
--

CREATE INDEX fact_servicio_diario_filtros ON dw.fact_servicio_diario USING btree (fecha_sk, servicio_sk, cliente_sk, sede_sk, supervisor_sk);


--
-- Name: fact_turno_filtros; Type: INDEX; Schema: dw; Owner: -
--

CREATE INDEX fact_turno_filtros ON dw.fact_turno USING btree (fecha_sk, servicio_sk, cliente_sk, sede_sk, supervisor_sk);


--
-- Name: idx_actividad_creado_en; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_actividad_creado_en ON public.actividad_reciente USING btree (creado_en DESC);


--
-- Name: idx_consignas_servicio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consignas_servicio ON public.consignas USING btree (servicio_id) WHERE (eliminado = false);


--
-- Name: idx_eval_servicio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_servicio ON public.evaluaciones_multicriterio USING btree (servicio_id) WHERE (eliminado = false);


--
-- Name: idx_evidencias_personal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evidencias_personal ON public.evidencias_servicio USING btree (personal_id) WHERE (eliminado = false);


--
-- Name: idx_evidencias_servicio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evidencias_servicio ON public.evidencias_servicio USING btree (servicio_id) WHERE (eliminado = false);


--
-- Name: idx_evidencias_servicio_fecha_activas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evidencias_servicio_fecha_activas ON public.evidencias_servicio USING btree (servicio_id, creado_en) WHERE (NOT eliminado);


--
-- Name: idx_evidencias_turno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evidencias_turno ON public.evidencias_servicio USING btree (turno_id) WHERE (NOT eliminado);


--
-- Name: idx_inc_servicio_registro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inc_servicio_registro ON public.incidencias USING btree (servicio_id, fecha_registro) WHERE (NOT eliminado);


--
-- Name: idx_incidencias_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidencias_estado ON public.incidencias USING btree (estado) WHERE (eliminado = false);


--
-- Name: idx_incidencias_servicio_fecha_activas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidencias_servicio_fecha_activas ON public.incidencias USING btree (servicio_id, fecha_registro) WHERE (NOT eliminado);


--
-- Name: idx_obligacion_plantilla_turno; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_obligacion_plantilla_turno ON public.obligaciones_operativas USING btree (turno_id, plantilla_id, secuencia) WHERE (NOT eliminado);


--
-- Name: idx_obligaciones_turno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_obligaciones_turno ON public.obligaciones_operativas USING btree (turno_id) WHERE (NOT eliminado);


--
-- Name: idx_ronda_plantilla_turno; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ronda_plantilla_turno ON public.rondas USING btree (turno_id, plantilla_id, secuencia) WHERE (NOT eliminado);


--
-- Name: idx_rondas_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rondas_estado ON public.rondas USING btree (estado) WHERE (eliminado = false);


--
-- Name: idx_rondas_servicio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rondas_servicio ON public.rondas USING btree (servicio_id) WHERE (eliminado = false);


--
-- Name: idx_rondas_turno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rondas_turno ON public.rondas USING btree (turno_id) WHERE (eliminado = false);


--
-- Name: idx_turnos_personal_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_turnos_personal_fecha ON public.turnos USING btree (personal_id, fecha) WHERE (eliminado = false);


--
-- Name: idx_turnos_servicio_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_turnos_servicio_fecha ON public.turnos USING btree (servicio_id, fecha) WHERE (NOT eliminado);


--
-- Name: idx_turnos_servicio_fecha_activos; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_turnos_servicio_fecha_activos ON public.turnos USING btree (servicio_id, fecha) WHERE (NOT eliminado);


--
-- Name: idx_verificaciones_consignas_consigna; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verificaciones_consignas_consigna ON public.verificaciones_consignas USING btree (consigna_id);


--
-- Name: idx_verificaciones_consignas_turno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verificaciones_consignas_turno ON public.verificaciones_consignas USING btree (turno_id);


--
-- Name: incidencias_ampliaciones_bandeja; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidencias_ampliaciones_bandeja ON public.incidencias_ampliaciones USING btree (estado, incidencia_id);


--
-- Name: incidencias_seguimiento_orden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidencias_seguimiento_orden ON public.incidencias_seguimiento USING btree (incidencia_id, creado_en, id);


--
-- Name: incidencias_una_ampliacion_pendiente; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX incidencias_una_ampliacion_pendiente ON public.incidencias_ampliaciones USING btree (incidencia_id) WHERE (estado = 'pendiente'::text);


--
-- Name: servicios_codigo_externo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX servicios_codigo_externo ON public.servicios USING btree (codigo_externo) WHERE ((eliminado = false) AND (codigo_externo IS NOT NULL));


--
-- Name: turnos_clave_importacion; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX turnos_clave_importacion ON public.turnos USING btree (clave_importacion) WHERE (clave_importacion IS NOT NULL);


--
-- Name: uidx_incidencias_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uidx_incidencias_codigo ON public.incidencias USING btree (codigo) WHERE (eliminado = false);


--
-- Name: uidx_personal_documento; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uidx_personal_documento ON public.personal USING btree (documento) WHERE (eliminado = false);


--
-- Name: uidx_protocolos_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uidx_protocolos_codigo ON public.protocolos USING btree (codigo) WHERE (eliminado = false);


--
-- Name: uidx_servicio_protocolos; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uidx_servicio_protocolos ON public.servicio_protocolos USING btree (servicio_id, protocolo_id) WHERE (eliminado = false);


--
-- Name: incidencias trg_auditar_incidencia; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_incidencia AFTER INSERT OR UPDATE ON public.incidencias FOR EACH ROW EXECUTE FUNCTION public.auditar_incidencia();


--
-- Name: turnos trg_auditar_turno; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditar_turno AFTER INSERT OR UPDATE ON public.turnos FOR EACH ROW EXECUTE FUNCTION public.auditar_turno();


--
-- Name: turnos trg_generar_plan_turno; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_generar_plan_turno AFTER INSERT OR UPDATE OF servicio_id, fecha, hora_inicio, hora_fin ON public.turnos FOR EACH ROW EXECUTE FUNCTION public.generar_plan_turno();


--
-- Name: incidencias trg_plazos_incidencia; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plazos_incidencia BEFORE INSERT OR UPDATE ON public.incidencias FOR EACH ROW EXECUTE FUNCTION public.completar_plazos_incidencia();


--
-- Name: dim_servicio dim_servicio_cliente_id_fkey; Type: FK CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.dim_servicio
    ADD CONSTRAINT dim_servicio_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES bi.dim_cliente(id);


--
-- Name: dim_servicio dim_servicio_sede_id_fkey; Type: FK CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.dim_servicio
    ADD CONSTRAINT dim_servicio_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES bi.dim_sede(id);


--
-- Name: hecho_evidencia hecho_evidencia_turno_id_fkey; Type: FK CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.hecho_evidencia
    ADD CONSTRAINT hecho_evidencia_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES bi.hecho_turno(id);


--
-- Name: hecho_incidencia hecho_incidencia_fecha_fkey; Type: FK CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.hecho_incidencia
    ADD CONSTRAINT hecho_incidencia_fecha_fkey FOREIGN KEY (fecha) REFERENCES bi.dim_fecha(fecha);


--
-- Name: hecho_incidencia hecho_incidencia_responsable_id_fkey; Type: FK CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.hecho_incidencia
    ADD CONSTRAINT hecho_incidencia_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES bi.dim_personal(id);


--
-- Name: hecho_incidencia hecho_incidencia_servicio_id_fkey; Type: FK CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.hecho_incidencia
    ADD CONSTRAINT hecho_incidencia_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES bi.dim_servicio(id);


--
-- Name: hecho_turno hecho_turno_fecha_fkey; Type: FK CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.hecho_turno
    ADD CONSTRAINT hecho_turno_fecha_fkey FOREIGN KEY (fecha) REFERENCES bi.dim_fecha(fecha);


--
-- Name: hecho_turno hecho_turno_personal_id_fkey; Type: FK CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.hecho_turno
    ADD CONSTRAINT hecho_turno_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES bi.dim_personal(id);


--
-- Name: hecho_turno hecho_turno_servicio_id_fkey; Type: FK CONSTRAINT; Schema: bi; Owner: -
--

ALTER TABLE ONLY bi.hecho_turno
    ADD CONSTRAINT hecho_turno_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES bi.dim_servicio(id);


--
-- Name: fact_incidencia fact_incidencia_cliente_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_incidencia
    ADD CONSTRAINT fact_incidencia_cliente_sk_fkey FOREIGN KEY (cliente_sk) REFERENCES dw.dim_cliente(sk);


--
-- Name: fact_incidencia fact_incidencia_fecha_atencion_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_incidencia
    ADD CONSTRAINT fact_incidencia_fecha_atencion_sk_fkey FOREIGN KEY (fecha_atencion_sk) REFERENCES dw.dim_fecha(fecha_sk);


--
-- Name: fact_incidencia fact_incidencia_fecha_cierre_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_incidencia
    ADD CONSTRAINT fact_incidencia_fecha_cierre_sk_fkey FOREIGN KEY (fecha_cierre_sk) REFERENCES dw.dim_fecha(fecha_sk);


--
-- Name: fact_incidencia fact_incidencia_fecha_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_incidencia
    ADD CONSTRAINT fact_incidencia_fecha_sk_fkey FOREIGN KEY (fecha_sk) REFERENCES dw.dim_fecha(fecha_sk);


--
-- Name: fact_incidencia fact_incidencia_sede_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_incidencia
    ADD CONSTRAINT fact_incidencia_sede_sk_fkey FOREIGN KEY (sede_sk) REFERENCES dw.dim_sede(sk);


--
-- Name: fact_incidencia fact_incidencia_servicio_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_incidencia
    ADD CONSTRAINT fact_incidencia_servicio_sk_fkey FOREIGN KEY (servicio_sk) REFERENCES dw.dim_servicio(sk);


--
-- Name: fact_incidencia fact_incidencia_supervisor_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_incidencia
    ADD CONSTRAINT fact_incidencia_supervisor_sk_fkey FOREIGN KEY (supervisor_sk) REFERENCES dw.dim_supervisor(sk);


--
-- Name: fact_incidencia fact_incidencia_tipo_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_incidencia
    ADD CONSTRAINT fact_incidencia_tipo_sk_fkey FOREIGN KEY (tipo_sk) REFERENCES dw.dim_tipo_incidencia(sk);


--
-- Name: fact_meta fact_meta_desde_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_meta
    ADD CONSTRAINT fact_meta_desde_sk_fkey FOREIGN KEY (desde_sk) REFERENCES dw.dim_fecha(fecha_sk);


--
-- Name: fact_meta fact_meta_hasta_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_meta
    ADD CONSTRAINT fact_meta_hasta_sk_fkey FOREIGN KEY (hasta_sk) REFERENCES dw.dim_fecha(fecha_sk);


--
-- Name: fact_meta fact_meta_indicador_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_meta
    ADD CONSTRAINT fact_meta_indicador_sk_fkey FOREIGN KEY (indicador_sk) REFERENCES dw.dim_indicador(sk);


--
-- Name: fact_obligacion fact_obligacion_cliente_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_obligacion
    ADD CONSTRAINT fact_obligacion_cliente_sk_fkey FOREIGN KEY (cliente_sk) REFERENCES dw.dim_cliente(sk);


--
-- Name: fact_obligacion fact_obligacion_fecha_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_obligacion
    ADD CONSTRAINT fact_obligacion_fecha_sk_fkey FOREIGN KEY (fecha_sk) REFERENCES dw.dim_fecha(fecha_sk);


--
-- Name: fact_obligacion fact_obligacion_sede_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_obligacion
    ADD CONSTRAINT fact_obligacion_sede_sk_fkey FOREIGN KEY (sede_sk) REFERENCES dw.dim_sede(sk);


--
-- Name: fact_obligacion fact_obligacion_servicio_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_obligacion
    ADD CONSTRAINT fact_obligacion_servicio_sk_fkey FOREIGN KEY (servicio_sk) REFERENCES dw.dim_servicio(sk);


--
-- Name: fact_obligacion fact_obligacion_supervisor_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_obligacion
    ADD CONSTRAINT fact_obligacion_supervisor_sk_fkey FOREIGN KEY (supervisor_sk) REFERENCES dw.dim_supervisor(sk);


--
-- Name: fact_obligacion fact_obligacion_tipo_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_obligacion
    ADD CONSTRAINT fact_obligacion_tipo_sk_fkey FOREIGN KEY (tipo_sk) REFERENCES dw.dim_tipo_obligacion(sk);


--
-- Name: fact_ronda fact_ronda_cliente_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_ronda
    ADD CONSTRAINT fact_ronda_cliente_sk_fkey FOREIGN KEY (cliente_sk) REFERENCES dw.dim_cliente(sk);


--
-- Name: fact_ronda fact_ronda_fecha_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_ronda
    ADD CONSTRAINT fact_ronda_fecha_sk_fkey FOREIGN KEY (fecha_sk) REFERENCES dw.dim_fecha(fecha_sk);


--
-- Name: fact_ronda fact_ronda_sede_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_ronda
    ADD CONSTRAINT fact_ronda_sede_sk_fkey FOREIGN KEY (sede_sk) REFERENCES dw.dim_sede(sk);


--
-- Name: fact_ronda fact_ronda_servicio_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_ronda
    ADD CONSTRAINT fact_ronda_servicio_sk_fkey FOREIGN KEY (servicio_sk) REFERENCES dw.dim_servicio(sk);


--
-- Name: fact_ronda fact_ronda_supervisor_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_ronda
    ADD CONSTRAINT fact_ronda_supervisor_sk_fkey FOREIGN KEY (supervisor_sk) REFERENCES dw.dim_supervisor(sk);


--
-- Name: fact_servicio_diario fact_servicio_diario_cliente_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_servicio_diario
    ADD CONSTRAINT fact_servicio_diario_cliente_sk_fkey FOREIGN KEY (cliente_sk) REFERENCES dw.dim_cliente(sk);


--
-- Name: fact_servicio_diario fact_servicio_diario_fecha_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_servicio_diario
    ADD CONSTRAINT fact_servicio_diario_fecha_sk_fkey FOREIGN KEY (fecha_sk) REFERENCES dw.dim_fecha(fecha_sk);


--
-- Name: fact_servicio_diario fact_servicio_diario_sede_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_servicio_diario
    ADD CONSTRAINT fact_servicio_diario_sede_sk_fkey FOREIGN KEY (sede_sk) REFERENCES dw.dim_sede(sk);


--
-- Name: fact_servicio_diario fact_servicio_diario_servicio_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_servicio_diario
    ADD CONSTRAINT fact_servicio_diario_servicio_sk_fkey FOREIGN KEY (servicio_sk) REFERENCES dw.dim_servicio(sk);


--
-- Name: fact_servicio_diario fact_servicio_diario_supervisor_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_servicio_diario
    ADD CONSTRAINT fact_servicio_diario_supervisor_sk_fkey FOREIGN KEY (supervisor_sk) REFERENCES dw.dim_supervisor(sk);


--
-- Name: fact_turno fact_turno_cliente_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_turno
    ADD CONSTRAINT fact_turno_cliente_sk_fkey FOREIGN KEY (cliente_sk) REFERENCES dw.dim_cliente(sk);


--
-- Name: fact_turno fact_turno_fecha_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_turno
    ADD CONSTRAINT fact_turno_fecha_sk_fkey FOREIGN KEY (fecha_sk) REFERENCES dw.dim_fecha(fecha_sk);


--
-- Name: fact_turno fact_turno_personal_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_turno
    ADD CONSTRAINT fact_turno_personal_sk_fkey FOREIGN KEY (personal_sk) REFERENCES dw.dim_personal(sk);


--
-- Name: fact_turno fact_turno_sede_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_turno
    ADD CONSTRAINT fact_turno_sede_sk_fkey FOREIGN KEY (sede_sk) REFERENCES dw.dim_sede(sk);


--
-- Name: fact_turno fact_turno_servicio_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_turno
    ADD CONSTRAINT fact_turno_servicio_sk_fkey FOREIGN KEY (servicio_sk) REFERENCES dw.dim_servicio(sk);


--
-- Name: fact_turno fact_turno_supervisor_sk_fkey; Type: FK CONSTRAINT; Schema: dw; Owner: -
--

ALTER TABLE ONLY dw.fact_turno
    ADD CONSTRAINT fact_turno_supervisor_sk_fkey FOREIGN KEY (supervisor_sk) REFERENCES dw.dim_supervisor(sk);


--
-- Name: actividad_reciente actividad_reciente_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividad_reciente
    ADD CONSTRAINT actividad_reciente_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: clientes clientes_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: consignas consignas_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consignas
    ADD CONSTRAINT consignas_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: consignas consignas_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consignas
    ADD CONSTRAINT consignas_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id);


--
-- Name: criterios_mcda criterios_mcda_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.criterios_mcda
    ADD CONSTRAINT criterios_mcda_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: evaluacion_criterios evaluacion_criterios_criterio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluacion_criterios
    ADD CONSTRAINT evaluacion_criterios_criterio_id_fkey FOREIGN KEY (criterio_id) REFERENCES public.criterios_mcda(id);


--
-- Name: evaluacion_criterios evaluacion_criterios_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluacion_criterios
    ADD CONSTRAINT evaluacion_criterios_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: evaluacion_criterios evaluacion_criterios_evaluacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluacion_criterios
    ADD CONSTRAINT evaluacion_criterios_evaluacion_id_fkey FOREIGN KEY (evaluacion_id) REFERENCES public.evaluaciones_multicriterio(id);


--
-- Name: evaluaciones_multicriterio evaluaciones_multicriterio_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones_multicriterio
    ADD CONSTRAINT evaluaciones_multicriterio_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: evaluaciones_multicriterio evaluaciones_multicriterio_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones_multicriterio
    ADD CONSTRAINT evaluaciones_multicriterio_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id);


--
-- Name: evaluaciones_operativas evaluaciones_operativas_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones_operativas
    ADD CONSTRAINT evaluaciones_operativas_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id);


--
-- Name: evaluaciones_operativas evaluaciones_operativas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones_operativas
    ADD CONSTRAINT evaluaciones_operativas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: evidencias_servicio evidencias_servicio_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencias_servicio
    ADD CONSTRAINT evidencias_servicio_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: evidencias_servicio evidencias_servicio_personal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencias_servicio
    ADD CONSTRAINT evidencias_servicio_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id);


--
-- Name: evidencias_servicio evidencias_servicio_protocolo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencias_servicio
    ADD CONSTRAINT evidencias_servicio_protocolo_id_fkey FOREIGN KEY (protocolo_id) REFERENCES public.protocolos(id);


--
-- Name: evidencias_servicio evidencias_servicio_revisado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencias_servicio
    ADD CONSTRAINT evidencias_servicio_revisado_por_fkey FOREIGN KEY (revisado_por) REFERENCES public.usuarios(id);


--
-- Name: evidencias_servicio evidencias_servicio_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencias_servicio
    ADD CONSTRAINT evidencias_servicio_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id);


--
-- Name: evidencias_servicio evidencias_servicio_turno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencias_servicio
    ADD CONSTRAINT evidencias_servicio_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id);


--
-- Name: importacion_filas importacion_filas_importacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.importacion_filas
    ADD CONSTRAINT importacion_filas_importacion_id_fkey FOREIGN KEY (importacion_id) REFERENCES public.importaciones(id);


--
-- Name: importacion_filas importacion_filas_turno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.importacion_filas
    ADD CONSTRAINT importacion_filas_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id);


--
-- Name: importaciones importaciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.importaciones
    ADD CONSTRAINT importaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: incidencias_ampliaciones incidencias_ampliaciones_decidido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias_ampliaciones
    ADD CONSTRAINT incidencias_ampliaciones_decidido_por_fkey FOREIGN KEY (decidido_por) REFERENCES public.usuarios(id);


--
-- Name: incidencias_ampliaciones incidencias_ampliaciones_incidencia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias_ampliaciones
    ADD CONSTRAINT incidencias_ampliaciones_incidencia_id_fkey FOREIGN KEY (incidencia_id) REFERENCES public.incidencias(id);


--
-- Name: incidencias_ampliaciones incidencias_ampliaciones_solicitado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias_ampliaciones
    ADD CONSTRAINT incidencias_ampliaciones_solicitado_por_fkey FOREIGN KEY (solicitado_por) REFERENCES public.usuarios(id);


--
-- Name: incidencias incidencias_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: incidencias_historial incidencias_historial_incidencia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias_historial
    ADD CONSTRAINT incidencias_historial_incidencia_id_fkey FOREIGN KEY (incidencia_id) REFERENCES public.incidencias(id);


--
-- Name: incidencias_historial incidencias_historial_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias_historial
    ADD CONSTRAINT incidencias_historial_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: incidencias incidencias_personal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id);


--
-- Name: incidencias incidencias_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.usuarios(id);


--
-- Name: incidencias incidencias_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.personal(id);


--
-- Name: incidencias_seguimiento incidencias_seguimiento_incidencia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias_seguimiento
    ADD CONSTRAINT incidencias_seguimiento_incidencia_id_fkey FOREIGN KEY (incidencia_id) REFERENCES public.incidencias(id);


--
-- Name: incidencias_seguimiento incidencias_seguimiento_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias_seguimiento
    ADD CONSTRAINT incidencias_seguimiento_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: incidencias incidencias_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id);


--
-- Name: incidencias incidencias_tipo_incidencia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_tipo_incidencia_id_fkey FOREIGN KEY (tipo_incidencia_id) REFERENCES public.tipos_incidencia(id);


--
-- Name: incidencias incidencias_turno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id);


--
-- Name: metas_bi metas_bi_actualizado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas_bi
    ADD CONSTRAINT metas_bi_actualizado_por_fkey FOREIGN KEY (actualizado_por) REFERENCES public.usuarios(id);


--
-- Name: metas_bi metas_bi_codigo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas_bi
    ADD CONSTRAINT metas_bi_codigo_fkey FOREIGN KEY (codigo) REFERENCES public.indicadores_bi(codigo);


--
-- Name: obligaciones_operativas obligaciones_operativas_completado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligaciones_operativas
    ADD CONSTRAINT obligaciones_operativas_completado_por_fkey FOREIGN KEY (completado_por) REFERENCES public.usuarios(id);


--
-- Name: obligaciones_operativas obligaciones_operativas_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligaciones_operativas
    ADD CONSTRAINT obligaciones_operativas_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(id);


--
-- Name: obligaciones_operativas obligaciones_operativas_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligaciones_operativas
    ADD CONSTRAINT obligaciones_operativas_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: obligaciones_operativas obligaciones_operativas_plantilla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligaciones_operativas
    ADD CONSTRAINT obligaciones_operativas_plantilla_id_fkey FOREIGN KEY (plantilla_id) REFERENCES public.plantillas_operativas(id);


--
-- Name: obligaciones_operativas obligaciones_operativas_revisado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligaciones_operativas
    ADD CONSTRAINT obligaciones_operativas_revisado_por_fkey FOREIGN KEY (revisado_por) REFERENCES public.usuarios(id);


--
-- Name: obligaciones_operativas obligaciones_operativas_turno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligaciones_operativas
    ADD CONSTRAINT obligaciones_operativas_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id);


--
-- Name: personal_ausencias personal_ausencias_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_ausencias
    ADD CONSTRAINT personal_ausencias_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(id);


--
-- Name: personal_ausencias personal_ausencias_personal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_ausencias
    ADD CONSTRAINT personal_ausencias_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id);


--
-- Name: personal personal_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal
    ADD CONSTRAINT personal_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: personal personal_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal
    ADD CONSTRAINT personal_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id);


--
-- Name: personal personal_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal
    ADD CONSTRAINT personal_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: planes_operativos planes_operativos_actualizado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planes_operativos
    ADD CONSTRAINT planes_operativos_actualizado_por_fkey FOREIGN KEY (actualizado_por) REFERENCES public.usuarios(id);


--
-- Name: planes_operativos planes_operativos_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planes_operativos
    ADD CONSTRAINT planes_operativos_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id);


--
-- Name: plantillas_operativas plantillas_operativas_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas_operativas
    ADD CONSTRAINT plantillas_operativas_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id);


--
-- Name: protocolos protocolos_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocolos
    ADD CONSTRAINT protocolos_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: reportes_generados reportes_generados_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes_generados
    ADD CONSTRAINT reportes_generados_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: reportes_generados reportes_generados_generado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes_generados
    ADD CONSTRAINT reportes_generados_generado_por_fkey FOREIGN KEY (generado_por) REFERENCES public.usuarios(id);


--
-- Name: revisiones_reportes revisiones_reportes_reporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_reportes
    ADD CONSTRAINT revisiones_reportes_reporte_id_fkey FOREIGN KEY (reporte_id) REFERENCES public.obligaciones_operativas(id);


--
-- Name: revisiones_reportes revisiones_reportes_revisado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_reportes
    ADD CONSTRAINT revisiones_reportes_revisado_por_fkey FOREIGN KEY (revisado_por) REFERENCES public.usuarios(id);


--
-- Name: rondas rondas_completado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rondas
    ADD CONSTRAINT rondas_completado_por_fkey FOREIGN KEY (completado_por) REFERENCES public.usuarios(id);


--
-- Name: rondas rondas_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rondas
    ADD CONSTRAINT rondas_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(id);


--
-- Name: rondas rondas_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rondas
    ADD CONSTRAINT rondas_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: rondas rondas_plantilla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rondas
    ADD CONSTRAINT rondas_plantilla_id_fkey FOREIGN KEY (plantilla_id) REFERENCES public.plantillas_operativas(id);


--
-- Name: rondas rondas_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rondas
    ADD CONSTRAINT rondas_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id);


--
-- Name: rondas rondas_turno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rondas
    ADD CONSTRAINT rondas_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id);


--
-- Name: sedes sedes_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sedes
    ADD CONSTRAINT sedes_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: servicio_contenedores servicio_contenedores_contenedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_contenedores
    ADD CONSTRAINT servicio_contenedores_contenedor_id_fkey FOREIGN KEY (contenedor_id) REFERENCES public.contenedores(id);


--
-- Name: servicio_contenedores servicio_contenedores_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_contenedores
    ADD CONSTRAINT servicio_contenedores_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id);


--
-- Name: servicio_custodias servicio_custodias_destino_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_custodias
    ADD CONSTRAINT servicio_custodias_destino_id_fkey FOREIGN KEY (destino_id) REFERENCES public.ubicaciones_operativas(id);


--
-- Name: servicio_custodias servicio_custodias_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_custodias
    ADD CONSTRAINT servicio_custodias_origen_id_fkey FOREIGN KEY (origen_id) REFERENCES public.ubicaciones_operativas(id);


--
-- Name: servicio_custodias servicio_custodias_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_custodias
    ADD CONSTRAINT servicio_custodias_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id);


--
-- Name: servicio_custodias servicio_custodias_transportista_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_custodias
    ADD CONSTRAINT servicio_custodias_transportista_id_fkey FOREIGN KEY (transportista_id) REFERENCES public.transportistas(id);


--
-- Name: servicio_personal servicio_personal_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_personal
    ADD CONSTRAINT servicio_personal_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: servicio_personal servicio_personal_personal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_personal
    ADD CONSTRAINT servicio_personal_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id);


--
-- Name: servicio_personal servicio_personal_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_personal
    ADD CONSTRAINT servicio_personal_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id);


--
-- Name: servicio_protocolos servicio_protocolos_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_protocolos
    ADD CONSTRAINT servicio_protocolos_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: servicio_protocolos servicio_protocolos_protocolo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_protocolos
    ADD CONSTRAINT servicio_protocolos_protocolo_id_fkey FOREIGN KEY (protocolo_id) REFERENCES public.protocolos(id);


--
-- Name: servicio_protocolos servicio_protocolos_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_protocolos
    ADD CONSTRAINT servicio_protocolos_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id);


--
-- Name: servicio_requerimientos servicio_requerimientos_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_requerimientos
    ADD CONSTRAINT servicio_requerimientos_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: servicio_requerimientos servicio_requerimientos_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_requerimientos
    ADD CONSTRAINT servicio_requerimientos_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id);


--
-- Name: servicio_vehiculos servicio_vehiculos_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_vehiculos
    ADD CONSTRAINT servicio_vehiculos_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id);


--
-- Name: servicio_vehiculos servicio_vehiculos_vehiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_vehiculos
    ADD CONSTRAINT servicio_vehiculos_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id);


--
-- Name: servicios servicios_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: servicios servicios_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: servicios servicios_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id);


--
-- Name: servicios servicios_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.personal(id);


--
-- Name: tipos_incidencia tipos_incidencia_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_incidencia
    ADD CONSTRAINT tipos_incidencia_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: turnos turnos_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos
    ADD CONSTRAINT turnos_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(id);


--
-- Name: turnos turnos_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos
    ADD CONSTRAINT turnos_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: turnos_historial turnos_historial_turno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos_historial
    ADD CONSTRAINT turnos_historial_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id);


--
-- Name: turnos_historial turnos_historial_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos_historial
    ADD CONSTRAINT turnos_historial_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: turnos turnos_personal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos
    ADD CONSTRAINT turnos_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id);


--
-- Name: turnos turnos_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos
    ADD CONSTRAINT turnos_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id);


--
-- Name: turnos turnos_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos
    ADD CONSTRAINT turnos_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id);


--
-- Name: usuarios usuarios_eliminado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_eliminado_por_fkey FOREIGN KEY (eliminado_por) REFERENCES public.usuarios(id);


--
-- Name: verificaciones_consignas verificaciones_consignas_consigna_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verificaciones_consignas
    ADD CONSTRAINT verificaciones_consignas_consigna_id_fkey FOREIGN KEY (consigna_id) REFERENCES public.consignas(id);


--
-- Name: verificaciones_consignas verificaciones_consignas_turno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verificaciones_consignas
    ADD CONSTRAINT verificaciones_consignas_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id);


--
-- Name: verificaciones_consignas verificaciones_consignas_verificado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verificaciones_consignas
    ADD CONSTRAINT verificaciones_consignas_verificado_por_fkey FOREIGN KEY (verificado_por) REFERENCES public.usuarios(id);


--
-- PostgreSQL database dump complete
--



COMMIT;

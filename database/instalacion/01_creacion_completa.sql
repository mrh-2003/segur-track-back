-- Segur Track · instalación completa · generado 2026-11-04T14:32:20.563Z
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


-- Dumped from database version 18.6 (ac70818)
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
    CONSTRAINT configuracion_operativa_id_check CHECK ((id = 1)),
    CONSTRAINT configuracion_operativa_sla_alta_check CHECK ((sla_alta > 0)),
    CONSTRAINT configuracion_operativa_sla_baja_check CHECK ((sla_baja > 0)),
    CONSTRAINT configuracion_operativa_sla_media_check CHECK ((sla_media > 0))
);


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
    CONSTRAINT incidencias_estado_check CHECK (((estado)::text = ANY ((ARRAY['abierta'::character varying, 'en_atencion'::character varying, 'cerrada'::character varying])::text[]))),
    CONSTRAINT incidencias_prioridad_check CHECK (((prioridad)::text = ANY ((ARRAY['alta'::character varying, 'media'::character varying, 'baja'::character varying])::text[]))),
    CONSTRAINT incidencias_sla_min_check CHECK ((sla_min > 0))
);


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
    CONSTRAINT personal_cargo_check CHECK (((cargo)::text = ANY ((ARRAY['jefe_operaciones'::character varying, 'supervisor'::character varying, 'agente'::character varying, 'administrativo'::character varying])::text[]))),
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
    CONSTRAINT turnos_estado_check CHECK (((estado)::text = ANY ((ARRAY['programado'::character varying, 'confirmado'::character varying, 'sin_confirmar'::character varying, 'cumplido'::character varying, 'pendiente'::character varying])::text[]))),
    CONSTRAINT turnos_evidencias_registradas_check CHECK ((evidencias_registradas >= 0)),
    CONSTRAINT turnos_evidencias_requeridas_check CHECK ((evidencias_requeridas >= 0)),
    CONSTRAINT turnos_tolerancia_min_check CHECK (((tolerancia_min >= 0) AND (tolerancia_min <= 120)))
);


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
     JOIN public.servicios s ON (((em.servicio_id = s.id) AND (s.eliminado = false))))
     JOIN public.clientes c ON (((s.cliente_id = c.id) AND (c.eliminado = false))))
     JOIN public.evaluacion_criterios ec ON (((ec.evaluacion_id = em.id) AND (ec.eliminado = false))))
     JOIN public.criterios_mcda cm ON (((ec.criterio_id = cm.id) AND (cm.eliminado = false))))
  WHERE (em.eliminado = false)
  GROUP BY em.id, s.nombre, c.nombre, em.fecha_evaluacion, em.puntaje_global, em.nivel;


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
-- Name: actividad_reciente id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividad_reciente ALTER COLUMN id SET DEFAULT nextval('public.actividad_reciente_id_seq'::regclass);


--
-- Name: clientes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes ALTER COLUMN id SET DEFAULT nextval('public.clientes_id_seq'::regclass);


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
-- Name: incidencias_historial id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidencias_historial ALTER COLUMN id SET DEFAULT nextval('public.incidencias_historial_id_seq'::regclass);


--
-- Name: personal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal ALTER COLUMN id SET DEFAULT nextval('public.personal_id_seq'::regclass);


--
-- Name: personal_ausencias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_ausencias ALTER COLUMN id SET DEFAULT nextval('public.personal_ausencias_id_seq'::regclass);


--
-- Name: protocolos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocolos ALTER COLUMN id SET DEFAULT nextval('public.protocolos_id_seq'::regclass);


--
-- Name: reportes_generados id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes_generados ALTER COLUMN id SET DEFAULT nextval('public.reportes_generados_id_seq'::regclass);


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
-- Name: idx_actividad_creado_en; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_actividad_creado_en ON public.actividad_reciente USING btree (creado_en DESC);


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
-- PostgreSQL database dump complete
--



COMMIT;

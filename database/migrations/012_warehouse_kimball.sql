-- Almacén Kimball independiente. Todas las FK apuntan exclusivamente a dw.
CREATE SCHEMA IF NOT EXISTS dw;
CREATE SCHEMA IF NOT EXISTS etl;
CREATE TABLE etl.ejecuciones(id BIGSERIAL PRIMARY KEY,origen TEXT NOT NULL,usuario_origen_id INT,iniciado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),finalizado_en TIMESTAMPTZ,estado TEXT NOT NULL CHECK(estado IN ('ejecutando','completado','error','interrumpido')),detalle JSONB,error TEXT);
CREATE TABLE etl.estado(id INT PRIMARY KEY CHECK(id=1),ultima_carga_en TIMESTAMPTZ,ultimo_id BIGINT,intervalo_min INT NOT NULL DEFAULT 60 CHECK(intervalo_min=60));
INSERT INTO etl.estado(id) VALUES(1);
CREATE TABLE dw.dim_fecha(fecha_sk INT PRIMARY KEY,fecha DATE UNIQUE,anio INT,mes INT,dia INT,trimestre INT,semana_iso INT,mes_nombre TEXT);
INSERT INTO dw.dim_fecha(fecha_sk,fecha,mes_nombre) VALUES(0,NULL,'Sin fecha');
CREATE TABLE dw.dim_cliente(sk BIGSERIAL PRIMARY KEY,origen_id INT NOT NULL,nombre TEXT NOT NULL,atributos JSONB NOT NULL DEFAULT '{}',huella TEXT NOT NULL,vigente_desde TIMESTAMPTZ NOT NULL DEFAULT '-infinity',vigente_hasta TIMESTAMPTZ NOT NULL DEFAULT 'infinity',actual BOOLEAN NOT NULL DEFAULT TRUE,CHECK(vigente_desde<vigente_hasta));
CREATE UNIQUE INDEX dim_cliente_actual ON dw.dim_cliente(origen_id) WHERE actual;
CREATE INDEX dim_cliente_version ON dw.dim_cliente(origen_id,vigente_desde,vigente_hasta);
INSERT INTO dw.dim_cliente(sk,origen_id,nombre,huella) VALUES(0,0,'Sin identificar','');
CREATE TABLE dw.dim_sede(sk BIGSERIAL PRIMARY KEY,origen_id INT NOT NULL,nombre TEXT NOT NULL,atributos JSONB NOT NULL DEFAULT '{}',huella TEXT NOT NULL,vigente_desde TIMESTAMPTZ NOT NULL DEFAULT '-infinity',vigente_hasta TIMESTAMPTZ NOT NULL DEFAULT 'infinity',actual BOOLEAN NOT NULL DEFAULT TRUE,CHECK(vigente_desde<vigente_hasta));
CREATE UNIQUE INDEX dim_sede_actual ON dw.dim_sede(origen_id) WHERE actual;
CREATE INDEX dim_sede_version ON dw.dim_sede(origen_id,vigente_desde,vigente_hasta);
INSERT INTO dw.dim_sede(sk,origen_id,nombre,huella) VALUES(0,0,'Sin identificar','');
CREATE TABLE dw.dim_supervisor(sk BIGSERIAL PRIMARY KEY,origen_id INT NOT NULL,nombre TEXT NOT NULL,atributos JSONB NOT NULL DEFAULT '{}',huella TEXT NOT NULL,vigente_desde TIMESTAMPTZ NOT NULL DEFAULT '-infinity',vigente_hasta TIMESTAMPTZ NOT NULL DEFAULT 'infinity',actual BOOLEAN NOT NULL DEFAULT TRUE,CHECK(vigente_desde<vigente_hasta));
CREATE UNIQUE INDEX dim_supervisor_actual ON dw.dim_supervisor(origen_id) WHERE actual;
CREATE INDEX dim_supervisor_version ON dw.dim_supervisor(origen_id,vigente_desde,vigente_hasta);
INSERT INTO dw.dim_supervisor(sk,origen_id,nombre,huella) VALUES(0,0,'Sin identificar','');
CREATE TABLE dw.dim_personal(sk BIGSERIAL PRIMARY KEY,origen_id INT NOT NULL,nombre TEXT NOT NULL,atributos JSONB NOT NULL DEFAULT '{}',huella TEXT NOT NULL,vigente_desde TIMESTAMPTZ NOT NULL DEFAULT '-infinity',vigente_hasta TIMESTAMPTZ NOT NULL DEFAULT 'infinity',actual BOOLEAN NOT NULL DEFAULT TRUE,CHECK(vigente_desde<vigente_hasta));
CREATE UNIQUE INDEX dim_personal_actual ON dw.dim_personal(origen_id) WHERE actual;
CREATE INDEX dim_personal_version ON dw.dim_personal(origen_id,vigente_desde,vigente_hasta);
INSERT INTO dw.dim_personal(sk,origen_id,nombre,huella) VALUES(0,0,'Sin identificar','');
CREATE TABLE dw.dim_servicio(sk BIGSERIAL PRIMARY KEY,origen_id INT NOT NULL,nombre TEXT NOT NULL,atributos JSONB NOT NULL DEFAULT '{}',huella TEXT NOT NULL,vigente_desde TIMESTAMPTZ NOT NULL DEFAULT '-infinity',vigente_hasta TIMESTAMPTZ NOT NULL DEFAULT 'infinity',actual BOOLEAN NOT NULL DEFAULT TRUE,CHECK(vigente_desde<vigente_hasta));
CREATE UNIQUE INDEX dim_servicio_actual ON dw.dim_servicio(origen_id) WHERE actual;
CREATE INDEX dim_servicio_version ON dw.dim_servicio(origen_id,vigente_desde,vigente_hasta);
INSERT INTO dw.dim_servicio(sk,origen_id,nombre,huella) VALUES(0,0,'Sin identificar','');
ALTER TABLE dw.dim_servicio ADD COLUMN estado TEXT,ADD COLUMN fecha_inicio DATE,ADD COLUMN fecha_fin DATE,ADD COLUMN cliente_origen_id INT,ADD COLUMN sede_origen_id INT,ADD COLUMN supervisor_origen_id INT;
CREATE TABLE dw.dim_tipo_incidencia(sk BIGSERIAL PRIMARY KEY,origen_id INT UNIQUE NOT NULL,nombre TEXT NOT NULL);
INSERT INTO dw.dim_tipo_incidencia(sk,origen_id,nombre) VALUES(0,0,'Sin tipo');
CREATE TABLE dw.dim_tipo_obligacion(sk INT PRIMARY KEY,nombre TEXT UNIQUE NOT NULL);
INSERT INTO dw.dim_tipo_obligacion VALUES(1,'actividad'),(2,'reporte'),(3,'ronda');
CREATE TABLE dw.dim_indicador(sk BIGSERIAL PRIMARY KEY,codigo TEXT UNIQUE NOT NULL,nombre TEXT NOT NULL,unidad TEXT NOT NULL,sentido TEXT NOT NULL,formula TEXT NOT NULL);
CREATE TABLE dw.fact_turno(sk BIGSERIAL PRIMARY KEY,turno_origen_id INT UNIQUE NOT NULL,servicio_sk BIGINT NOT NULL REFERENCES dw.dim_servicio(sk),cliente_sk BIGINT NOT NULL REFERENCES dw.dim_cliente(sk),sede_sk BIGINT NOT NULL REFERENCES dw.dim_sede(sk),supervisor_sk BIGINT NOT NULL REFERENCES dw.dim_supervisor(sk),fecha_sk INT NOT NULL REFERENCES dw.dim_fecha(fecha_sk),personal_sk BIGINT NOT NULL REFERENCES dw.dim_personal(sk),inicio_programado TIMESTAMPTZ,fin_programado TIMESTAMPTZ,ingreso_real TIMESTAMPTZ,salida_real TIMESTAMPTZ,tolerancia_min INT,estado TEXT,programados INT NOT NULL,exigibles INT NOT NULL,cubiertos INT NOT NULL,descubiertos INT NOT NULL,asignados_validados INT NOT NULL,ausentes INT NOT NULL,asistencias INT NOT NULL,tardanzas INT NOT NULL,validaciones_pendientes INT NOT NULL,carga_id BIGINT NOT NULL);
CREATE TABLE dw.fact_obligacion(sk BIGSERIAL PRIMARY KEY,obligacion_origen_id INT UNIQUE NOT NULL,turno_origen_id INT NOT NULL,servicio_sk BIGINT NOT NULL REFERENCES dw.dim_servicio(sk),cliente_sk BIGINT NOT NULL REFERENCES dw.dim_cliente(sk),sede_sk BIGINT NOT NULL REFERENCES dw.dim_sede(sk),supervisor_sk BIGINT NOT NULL REFERENCES dw.dim_supervisor(sk),fecha_sk INT NOT NULL REFERENCES dw.dim_fecha(fecha_sk),tipo_sk INT NOT NULL REFERENCES dw.dim_tipo_obligacion(sk),fecha_limite TIMESTAMPTZ,primera_entrega TIMESTAMPTZ,ultima_entrega TIMESTAMPTZ,estado_revision TEXT,programadas INT NOT NULL,exigibles INT NOT NULL,completadas INT NOT NULL,pendientes_vencidas INT NOT NULL,oportunas INT NOT NULL,revisados INT NOT NULL,observados INT NOT NULL,carga_id BIGINT NOT NULL);
CREATE TABLE dw.fact_ronda(sk BIGSERIAL PRIMARY KEY,ronda_origen_id INT UNIQUE NOT NULL,turno_origen_id INT NOT NULL,servicio_sk BIGINT NOT NULL REFERENCES dw.dim_servicio(sk),cliente_sk BIGINT NOT NULL REFERENCES dw.dim_cliente(sk),sede_sk BIGINT NOT NULL REFERENCES dw.dim_sede(sk),supervisor_sk BIGINT NOT NULL REFERENCES dw.dim_supervisor(sk),fecha_sk INT NOT NULL REFERENCES dw.dim_fecha(fecha_sk),fecha_programada TIMESTAMPTZ,fecha_completada TIMESTAMPTZ,programadas INT NOT NULL,exigibles INT NOT NULL,completadas INT NOT NULL,carga_id BIGINT NOT NULL);
CREATE TABLE dw.fact_incidencia(sk BIGSERIAL PRIMARY KEY,incidencia_origen_id INT UNIQUE NOT NULL,codigo TEXT,servicio_sk BIGINT NOT NULL REFERENCES dw.dim_servicio(sk),cliente_sk BIGINT NOT NULL REFERENCES dw.dim_cliente(sk),sede_sk BIGINT NOT NULL REFERENCES dw.dim_sede(sk),supervisor_sk BIGINT NOT NULL REFERENCES dw.dim_supervisor(sk),fecha_sk INT NOT NULL REFERENCES dw.dim_fecha(fecha_sk),tipo_sk BIGINT NOT NULL REFERENCES dw.dim_tipo_incidencia(sk),fecha_atencion_sk INT NOT NULL REFERENCES dw.dim_fecha(fecha_sk),fecha_cierre_sk INT NOT NULL REFERENCES dw.dim_fecha(fecha_sk),fecha_registro TIMESTAMPTZ,fecha_atencion TIMESTAMPTZ,fecha_cierre TIMESTAMPTZ,limite_atencion TIMESTAMPTZ,limite_resolucion TIMESTAMPTZ,prioridad TEXT,estado TEXT,cantidad INT NOT NULL,abiertas INT NOT NULL,atendidas INT NOT NULL,minutos_respuesta NUMERIC,resolucion_exigible INT NOT NULL,cerradas_en_plazo INT NOT NULL,atencion_exigible INT NOT NULL,atendidas_en_plazo INT NOT NULL,plazos_pendientes INT NOT NULL,carga_id BIGINT NOT NULL);
CREATE TABLE dw.fact_servicio_diario(sk BIGSERIAL PRIMARY KEY,servicio_origen_id INT NOT NULL,servicio_sk BIGINT NOT NULL REFERENCES dw.dim_servicio(sk),cliente_sk BIGINT NOT NULL REFERENCES dw.dim_cliente(sk),sede_sk BIGINT NOT NULL REFERENCES dw.dim_sede(sk),supervisor_sk BIGINT NOT NULL REFERENCES dw.dim_supervisor(sk),fecha_sk INT NOT NULL REFERENCES dw.dim_fecha(fecha_sk),activo INT NOT NULL,carga_id BIGINT NOT NULL,UNIQUE(servicio_origen_id,fecha_sk));
CREATE TABLE dw.fact_meta(sk BIGSERIAL PRIMARY KEY,indicador_sk BIGINT NOT NULL REFERENCES dw.dim_indicador(sk),desde_sk INT NOT NULL REFERENCES dw.dim_fecha(fecha_sk),hasta_sk INT NOT NULL REFERENCES dw.dim_fecha(fecha_sk),vigente_desde DATE NOT NULL,vigente_hasta DATE,valor NUMERIC,carga_id BIGINT NOT NULL,UNIQUE(indicador_sk,vigente_desde));
CREATE INDEX fact_turno_filtros ON dw.fact_turno(fecha_sk,servicio_sk,cliente_sk,sede_sk,supervisor_sk);
CREATE INDEX fact_obligacion_filtros ON dw.fact_obligacion(fecha_sk,servicio_sk,cliente_sk,sede_sk,supervisor_sk);
CREATE INDEX fact_ronda_filtros ON dw.fact_ronda(fecha_sk,servicio_sk,cliente_sk,sede_sk,supervisor_sk);
CREATE INDEX fact_incidencia_filtros ON dw.fact_incidencia(fecha_sk,servicio_sk,cliente_sk,sede_sk,supervisor_sk);
CREATE INDEX fact_servicio_diario_filtros ON dw.fact_servicio_diario(fecha_sk,servicio_sk,cliente_sk,sede_sk,supervisor_sk);
CREATE FUNCTION etl.dimension(tabla TEXT,registros JSONB,corte TIMESTAMPTZ) RETURNS VOID LANGUAGE plpgsql AS $f$
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
END $f$;
CREATE FUNCTION etl.cargar_dw(p_carga BIGINT,p_corte TIMESTAMPTZ) RETURNS JSONB LANGUAGE plpgsql AS $etl$
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
 COALESCE(to_char(i.fecha_atencion AT TIME ZONE 'America/Lima','YYYYMMDD')::int,0),COALESCE(to_char(i.fecha_cierre AT TIME ZONE 'America/Lima','YYYYMMDD')::int,0),i.fecha_registro,i.fecha_atencion,i.fecha_cierre,i.fecha_registro+make_interval(mins=>i.sla_min),i.fecha_registro+make_interval(mins=>i.sla_resolucion_min),i.prioridad,i.estado,1,
 (NOT(i.estado='cerrada' AND i.fecha_cierre IS NOT NULL AND i.fecha_cierre<=p_corte))::int,
 COALESCE((i.fecha_atencion BETWEEN i.fecha_registro AND p_corte)::int,0),CASE WHEN i.fecha_atencion BETWEEN i.fecha_registro AND p_corte THEN EXTRACT(EPOCH FROM i.fecha_atencion-i.fecha_registro)/60 END,
 COALESCE((i.sla_resolucion_min>0 AND (i.fecha_cierre<=p_corte OR i.fecha_registro+make_interval(mins=>i.sla_resolucion_min)<=p_corte))::int,0),
 COALESCE((i.estado='cerrada' AND i.fecha_cierre<=p_corte AND i.fecha_cierre<=i.fecha_registro+make_interval(mins=>i.sla_resolucion_min))::int,0),
 COALESCE((i.sla_min>0 AND (i.fecha_atencion<=p_corte OR i.fecha_registro+make_interval(mins=>i.sla_min)<=p_corte))::int,0),
 COALESCE((i.fecha_atencion BETWEEN i.fecha_registro AND LEAST(p_corte,i.fecha_registro+make_interval(mins=>i.sla_min)))::int,0),
 (i.sla_min IS NULL OR i.sla_resolucion_min IS NULL)::int,p_carga
 FROM public.incidencias i JOIN public.servicios s ON s.id=i.servicio_id AND NOT s.eliminado
 JOIN LATERAL(SELECT * FROM dw.dim_servicio WHERE origen_id=i.servicio_id AND vigente_desde<=i.fecha_registro AND i.fecha_registro<vigente_hasta ORDER BY vigente_desde DESC LIMIT 1)ds ON TRUE
 LEFT JOIN dw.dim_cliente dc ON dc.origen_id=ds.cliente_origen_id AND dc.vigente_desde<=i.fecha_registro AND i.fecha_registro<dc.vigente_hasta
 LEFT JOIN dw.dim_sede de ON de.origen_id=ds.sede_origen_id AND de.vigente_desde<=i.fecha_registro AND i.fecha_registro<de.vigente_hasta
 LEFT JOIN dw.dim_supervisor du ON du.origen_id=ds.supervisor_origen_id AND du.vigente_desde<=i.fecha_registro AND i.fecha_registro<du.vigente_hasta
 LEFT JOIN dw.dim_tipo_incidencia dt ON dt.origen_id=i.tipo_incidencia_id WHERE NOT i.eliminado AND i.fecha_registro<=p_corte;
 INSERT INTO dw.fact_servicio_diario(servicio_origen_id,servicio_sk,cliente_sk,sede_sk,supervisor_sk,fecha_sk,activo,carga_id)
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
END $etl$;
REVOKE ALL ON SCHEMA etl FROM PUBLIC;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bi_lector') THEN
 REVOKE SELECT ON ALL TABLES IN SCHEMA public,bi FROM bi_lector;
 GRANT USAGE ON SCHEMA dw TO bi_lector;
 GRANT SELECT ON ALL TABLES IN SCHEMA dw TO bi_lector;
 ALTER DEFAULT PRIVILEGES IN SCHEMA dw GRANT SELECT ON TABLES TO bi_lector;
END IF; END $$;

-- Incremental: conserva los registros y las evaluaciones del modelo anterior.
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS codigo_externo TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS servicios_codigo_externo ON servicios(codigo_externo) WHERE eliminado=FALSE AND codigo_externo IS NOT NULL;
ALTER TABLE turnos ALTER COLUMN personal_id DROP NOT NULL;
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS puesto TEXT;
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS ingreso_real TIMESTAMPTZ;
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS salida_real TIMESTAMPTZ;
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS asistencia_validada BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS tolerancia_min INT NOT NULL DEFAULT 10 CHECK(tolerancia_min BETWEEN 0 AND 120);
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS evidencias_requeridas INT CHECK(evidencias_requeridas >= 0);
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS evidencias_registradas INT CHECK(evidencias_registradas >= 0);
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS evidencia_limite TIMESTAMPTZ;
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS evidencia_registro TIMESTAMPTZ;
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS funcion TEXT;
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS clave_importacion TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS turnos_clave_importacion ON turnos(clave_importacion) WHERE clave_importacion IS NOT NULL;
CREATE TABLE IF NOT EXISTS turnos_historial (
 id BIGSERIAL PRIMARY KEY, turno_id INT NOT NULL REFERENCES turnos(id),
 anterior JSONB, nuevo JSONB NOT NULL, usuario_id INT REFERENCES usuarios(id), motivo TEXT,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION auditar_turno() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
DROP TRIGGER IF EXISTS trg_auditar_turno ON turnos;
CREATE TRIGGER trg_auditar_turno AFTER INSERT OR UPDATE ON turnos FOR EACH ROW EXECUTE FUNCTION auditar_turno();
CREATE TABLE IF NOT EXISTS personal_ausencias (
 id BIGSERIAL PRIMARY KEY, personal_id INT NOT NULL REFERENCES personal(id),
 inicio TIMESTAMPTZ NOT NULL, fin TIMESTAMPTZ NOT NULL, motivo TEXT NOT NULL,
 creado_por INT NOT NULL REFERENCES usuarios(id), eliminado BOOLEAN NOT NULL DEFAULT FALSE,
 CHECK(fin > inicio)
);
ALTER TABLE incidencias ADD COLUMN IF NOT EXISTS responsable_id INT REFERENCES personal(id);
ALTER TABLE incidencias ADD COLUMN IF NOT EXISTS turno_id INT REFERENCES turnos(id);
ALTER TABLE incidencias ADD COLUMN IF NOT EXISTS sla_min INT CHECK(sla_min > 0);
-- Plazos operativos iniciales configurables; no se atribuyen retroactivamente a casos históricos.
CREATE TABLE IF NOT EXISTS configuracion_operativa (
 id INT PRIMARY KEY CHECK(id=1), sla_alta INT NOT NULL DEFAULT 60 CHECK(sla_alta>0),
 sla_media INT NOT NULL DEFAULT 240 CHECK(sla_media>0), sla_baja INT NOT NULL DEFAULT 1440 CHECK(sla_baja>0)
);
INSERT INTO configuracion_operativa(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS incidencias_historial (
 id BIGSERIAL PRIMARY KEY, incidencia_id INT NOT NULL REFERENCES incidencias(id),
 anterior JSONB, nuevo JSONB NOT NULL, usuario_id INT REFERENCES usuarios(id), creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION auditar_incidencia() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO incidencias_historial(incidencia_id,anterior,nuevo,usuario_id)
 VALUES(NEW.id,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW),NULLIF(current_setting('app.usuario_id',true),'')::int);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_auditar_incidencia ON incidencias;
CREATE TRIGGER trg_auditar_incidencia AFTER INSERT OR UPDATE ON incidencias FOR EACH ROW EXECUTE FUNCTION auditar_incidencia();
CREATE TABLE IF NOT EXISTS modelo_operativo (
 codigo TEXT PRIMARY KEY, nombre TEXT NOT NULL, peso NUMERIC NOT NULL CHECK(peso BETWEEN 0 AND 1),
 umbral NUMERIC NOT NULL CHECK(umbral > 0 AND umbral <=100)
);
INSERT INTO modelo_operativo(codigo,nombre,peso,umbral) VALUES
 ('C1','Cumplimiento de turnos del personal',.20,10),
 ('C2','Puntualidad del personal',.20,20),
 ('C3','Cobertura de turnos del personal',.20,10),
 ('C4','Cumplimiento del registro de evidencias',.20,10),
 ('C5','Atención oportuna de incidencias',.20,30) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS evaluaciones_operativas (
 id BIGSERIAL PRIMARY KEY, servicio_id INT NOT NULL REFERENCES servicios(id),
 usuario_id INT REFERENCES usuarios(id), version TEXT NOT NULL,
 filtros JSONB NOT NULL, resultado JSONB NOT NULL, creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS importaciones (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), huella TEXT NOT NULL UNIQUE,
 nombre TEXT NOT NULL, usuario_id INT NOT NULL REFERENCES usuarios(id),
 datos JSONB NOT NULL, resultado JSONB, estado TEXT NOT NULL DEFAULT 'preparado',
 creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ubicaciones_operativas(id SERIAL PRIMARY KEY,nombre TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS transportistas(id SERIAL PRIMARY KEY,nombre TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS vehiculos(id SERIAL PRIMARY KEY,placa TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS contenedores(id SERIAL PRIMARY KEY,codigo TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS servicio_custodias (
 servicio_id INT PRIMARY KEY REFERENCES servicios(id), cliente_almacen TEXT, solicitante TEXT,
 referencias TEXT, transportista_id INT REFERENCES transportistas(id),
 origen_id INT REFERENCES ubicaciones_operativas(id), destino_id INT REFERENCES ubicaciones_operativas(id),
 hitos JSONB NOT NULL DEFAULT '{}', observacion TEXT
);
CREATE TABLE IF NOT EXISTS servicio_vehiculos (
 servicio_id INT REFERENCES servicios(id), vehiculo_id INT REFERENCES vehiculos(id), papel TEXT NOT NULL,
 PRIMARY KEY(servicio_id,vehiculo_id,papel)
);
CREATE TABLE IF NOT EXISTS servicio_contenedores (
 servicio_id INT REFERENCES servicios(id), contenedor_id INT REFERENCES contenedores(id),
 PRIMARY KEY(servicio_id,contenedor_id)
);
-- Hechos analíticos con granularidades separadas: evita multiplicar incidencias por turnos.
CREATE OR REPLACE VIEW vw_operacion_turnos AS
 SELECT t.*, (t.fecha+t.hora_inicio) AT TIME ZONE 'America/Lima' AS inicio_programado,
 (t.fecha+t.hora_fin+CASE WHEN t.hora_fin<=t.hora_inicio THEN INTERVAL '1 day' ELSE INTERVAL '0' END) AT TIME ZONE 'America/Lima' AS fin_programado
 FROM turnos t WHERE NOT t.eliminado;
CREATE INDEX IF NOT EXISTS idx_turnos_servicio_fecha ON turnos(servicio_id,fecha) WHERE NOT eliminado;
CREATE INDEX IF NOT EXISTS idx_inc_servicio_registro ON incidencias(servicio_id,fecha_registro) WHERE NOT eliminado;

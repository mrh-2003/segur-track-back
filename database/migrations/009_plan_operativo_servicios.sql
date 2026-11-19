-- Planificación reutilizable del servicio y ejecución por turno. 18/11/2026.
CREATE TABLE IF NOT EXISTS planes_operativos (
 servicio_id INT PRIMARY KEY REFERENCES servicios(id),
 confirmado BOOLEAN NOT NULL DEFAULT FALSE,
 actualizado_por INT REFERENCES usuarios(id),
 actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS plantillas_operativas (
 id SERIAL PRIMARY KEY,
 servicio_id INT NOT NULL REFERENCES servicios(id),
 tipo TEXT NOT NULL CHECK(tipo IN ('actividad','ronda','reporte')),
 descripcion TEXT NOT NULL CHECK(length(trim(descripcion))>=3),
 minutos_desde_inicio INT CHECK(minutos_desde_inicio BETWEEN 0 AND 1440),
 intervalo_min INT CHECK(intervalo_min BETWEEN 1 AND 1440),
 activo BOOLEAN NOT NULL DEFAULT TRUE,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE obligaciones_operativas
 ADD COLUMN IF NOT EXISTS plantilla_id INT REFERENCES plantillas_operativas(id),
 ADD COLUMN IF NOT EXISTS secuencia INT NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS resultado TEXT,
 ADD COLUMN IF NOT EXISTS evidencia_url TEXT,
 ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE rondas
 ADD COLUMN IF NOT EXISTS plantilla_id INT REFERENCES plantillas_operativas(id),
 ADD COLUMN IF NOT EXISTS secuencia INT NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS completado_por INT REFERENCES usuarios(id),
 ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE incidencias ADD COLUMN IF NOT EXISTS origen_plazo TEXT NOT NULL DEFAULT 'historico';
CREATE UNIQUE INDEX IF NOT EXISTS idx_obligacion_plantilla_turno
 ON obligaciones_operativas(turno_id,plantilla_id,secuencia) WHERE NOT eliminado;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ronda_plantilla_turno
 ON rondas(turno_id,plantilla_id,secuencia) WHERE NOT eliminado;

CREATE OR REPLACE FUNCTION programar_plan_turno(turno INT) RETURNS VOID LANGUAGE plpgsql AS $$
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
CREATE OR REPLACE FUNCTION generar_plan_turno() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM programar_plan_turno(NEW.id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_generar_plan_turno ON turnos;
CREATE TRIGGER trg_generar_plan_turno AFTER INSERT OR UPDATE OF servicio_id,fecha,hora_inicio,hora_fin
 ON turnos FOR EACH ROW EXECUTE FUNCTION generar_plan_turno();

CREATE OR REPLACE FUNCTION completar_plazos_incidencia() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
DROP TRIGGER IF EXISTS trg_plazos_incidencia ON incidencias;
CREATE TRIGGER trg_plazos_incidencia BEFORE INSERT OR UPDATE ON incidencias
 FOR EACH ROW EXECUTE FUNCTION completar_plazos_incidencia();

ALTER TABLE turnos ADD CONSTRAINT chk_turno_asistencia_orden CHECK(salida_real IS NULL OR (ingreso_real IS NOT NULL AND salida_real>ingreso_real)) NOT VALID;
ALTER TABLE incidencias ADD CONSTRAINT chk_inc_atencion_orden CHECK(fecha_atencion IS NULL OR fecha_atencion>=fecha_registro) NOT VALID;
-- Las restricciones NOT VALID protegen las escrituras sin reinterpretar el histórico existente.
CREATE SCHEMA IF NOT EXISTS bi;
CREATE TABLE IF NOT EXISTS bi.dim_fecha (
 fecha DATE PRIMARY KEY, anio INT NOT NULL, mes INT NOT NULL, dia INT NOT NULL, semana INT NOT NULL
);
CREATE TABLE IF NOT EXISTS bi.dim_cliente(id INT PRIMARY KEY,nombre TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS bi.dim_personal(id INT PRIMARY KEY,nombre TEXT NOT NULL,cargo TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS bi.dim_sede(id INT PRIMARY KEY,nombre TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS bi.dim_servicio(id INT PRIMARY KEY,nombre TEXT NOT NULL,cliente_id INT REFERENCES bi.dim_cliente(id),sede_id INT REFERENCES bi.dim_sede(id));
CREATE TABLE IF NOT EXISTS bi.hecho_turno (
 id INT PRIMARY KEY,servicio_id INT REFERENCES bi.dim_servicio(id),personal_id INT REFERENCES bi.dim_personal(id),fecha DATE REFERENCES bi.dim_fecha(fecha),
 inicio_programado TIMESTAMPTZ,fin_programado TIMESTAMPTZ,ingreso_real TIMESTAMPTZ,salida_real TIMESTAMPTZ,
 asistencia_validada BOOLEAN,estado TEXT,puesto TEXT,fuente JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS bi.hecho_evidencia (
 turno_id INT PRIMARY KEY REFERENCES bi.hecho_turno(id),requeridas INT,registradas INT,limite TIMESTAMPTZ,registro TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS bi.hecho_incidencia (
 id INT PRIMARY KEY,servicio_id INT REFERENCES bi.dim_servicio(id),fecha DATE REFERENCES bi.dim_fecha(fecha),
 prioridad TEXT,estado TEXT,registro TIMESTAMPTZ,atencion TIMESTAMPTZ,cierre TIMESTAMPTZ,sla_min INT,responsable_id INT REFERENCES bi.dim_personal(id)
);
CREATE TABLE IF NOT EXISTS bi.cargas (
 id BIGSERIAL PRIMARY KEY,fecha TIMESTAMPTZ DEFAULT NOW(),turnos INT,incidencias INT
);
CREATE OR REPLACE FUNCTION bi.refrescar() RETURNS VOID LANGUAGE plpgsql AS $$
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
SELECT bi.refrescar();

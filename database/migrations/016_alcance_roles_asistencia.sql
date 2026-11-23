ALTER TABLE sedes ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes(id);
ALTER TABLE sedes ADD COLUMN IF NOT EXISTS supervisor_id INTEGER REFERENCES personal(id);
-- Solo completar asociaciones inequívocas; las sedes compartidas requieren revisión.
UPDATE sedes se SET cliente_id=x.cliente_id FROM (
 SELECT sede_id, MIN(cliente_id) cliente_id FROM servicios WHERE NOT eliminado GROUP BY sede_id HAVING COUNT(DISTINCT cliente_id)=1
) x WHERE se.id=x.sede_id AND se.cliente_id IS NULL;
UPDATE sedes se SET supervisor_id=x.supervisor_id FROM (
 SELECT sede_id, MIN(supervisor_id) supervisor_id FROM servicios WHERE NOT eliminado GROUP BY sede_id HAVING COUNT(DISTINCT supervisor_id)=1
) x WHERE se.id=x.sede_id AND se.supervisor_id IS NULL;
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS ingreso_ubicacion JSONB;
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS salida_ubicacion JSONB;
CREATE TABLE IF NOT EXISTS notificaciones (
 id BIGSERIAL PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
 turno_id INTEGER REFERENCES turnos(id), titulo TEXT NOT NULL, mensaje TEXT NOT NULL,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(), leido_en TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id, creado_en DESC);
CREATE OR REPLACE FUNCTION notificar_asignacion_turno() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.personal_id IS NOT NULL AND NOT NEW.eliminado AND
    (TG_OP='INSERT' OR NEW.personal_id IS DISTINCT FROM OLD.personal_id) THEN
  INSERT INTO notificaciones(usuario_id,turno_id,titulo,mensaje)
  SELECT p.usuario_id,NEW.id,'Nuevo turno asignado',s.nombre||' · '||TO_CHAR(NEW.fecha,'DD/MM/YYYY')||' · '||NEW.hora_inicio||'–'||NEW.hora_fin
  FROM personal p JOIN servicios s ON s.id=NEW.servicio_id WHERE p.id=NEW.personal_id AND p.usuario_id IS NOT NULL;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notificar_asignacion ON turnos;
CREATE TRIGGER trg_notificar_asignacion AFTER INSERT OR UPDATE OF personal_id ON turnos FOR EACH ROW EXECUTE FUNCTION notificar_asignacion_turno();

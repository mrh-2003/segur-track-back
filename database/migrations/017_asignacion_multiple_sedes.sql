-- La sede se crea antes del supervisor; el responsable predeterminado es opcional.
ALTER TABLE sedes ALTER COLUMN supervisor_id DROP NOT NULL;
ALTER TABLE personal ALTER COLUMN sede_id DROP NOT NULL;
CREATE TABLE personal_sedes (
 personal_id INT NOT NULL REFERENCES personal(id),
 sede_id INT NOT NULL REFERENCES sedes(id),
 PRIMARY KEY(personal_id,sede_id)
);
CREATE INDEX personal_sedes_sede_idx ON personal_sedes(sede_id);
INSERT INTO personal_sedes SELECT id,sede_id FROM personal WHERE sede_id IS NOT NULL;
INSERT INTO personal_sedes
 SELECT supervisor_id,id FROM sedes WHERE supervisor_id IS NOT NULL AND NOT eliminado
 ON CONFLICT DO NOTHING;

CREATE FUNCTION asignar_responsable_sede() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.supervisor_id IS NOT NULL THEN
  INSERT INTO personal_sedes VALUES(NEW.supervisor_id,NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sede_responsable_asignacion AFTER INSERT OR UPDATE OF supervisor_id ON sedes
 FOR EACH ROW EXECUTE FUNCTION asignar_responsable_sede();

-- Conserva compatibilidad con importadores que escriben la sede principal.
CREATE FUNCTION sincronizar_sede_principal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.cargo NOT IN ('supervisor','jefe_operaciones') OR NEW.sede_id IS DISTINCT FROM OLD.sede_id) THEN
  DELETE FROM personal_sedes WHERE personal_id=NEW.id AND
   (NEW.cargo NOT IN ('supervisor','jefe_operaciones') OR sede_id=OLD.sede_id);
 END IF;
 IF NEW.sede_id IS NOT NULL THEN
  INSERT INTO personal_sedes VALUES(NEW.id,NEW.sede_id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER personal_sede_principal AFTER INSERT OR UPDATE OF sede_id,cargo ON personal
 FOR EACH ROW EXECUTE FUNCTION sincronizar_sede_principal();

-- La comprobación diferida permite sustituir todas las sedes en una transacción.
CREATE FUNCTION comprobar_cantidad_sedes() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pid INT; c TEXT; borrado BOOLEAN; principal INT; cantidad INT;
BEGIN
 IF TG_TABLE_NAME='personal' THEN pid=NEW.id;
 ELSIF TG_OP='DELETE' THEN pid=OLD.personal_id;
 ELSE pid=NEW.personal_id; END IF;
 SELECT cargo,eliminado,sede_id INTO c,borrado,principal FROM personal WHERE id=pid;
 IF c IS NULL OR borrado THEN RETURN NULL; END IF;
 SELECT COUNT(*) INTO cantidad FROM personal_sedes WHERE personal_id=pid;
 IF (c='supervisor' AND cantidad<1) OR (c='agente' AND cantidad<>1) THEN
  RAISE EXCEPTION 'El supervisor requiere al menos una sede y el agente exactamente una' USING ERRCODE='23514';
 END IF;
 IF principal IS NOT NULL AND NOT EXISTS(SELECT 1 FROM personal_sedes WHERE personal_id=pid AND sede_id=principal) THEN
  RAISE EXCEPTION 'La sede principal debe pertenecer a las sedes asignadas' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER personal_cantidad_sedes AFTER INSERT OR UPDATE ON personal
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION comprobar_cantidad_sedes();
CREATE CONSTRAINT TRIGGER asignacion_cantidad_sedes AFTER INSERT OR UPDATE OR DELETE ON personal_sedes
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION comprobar_cantidad_sedes();

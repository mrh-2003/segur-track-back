ALTER TABLE personal DROP CONSTRAINT personal_cargo_check;
ALTER TABLE personal ADD CONSTRAINT personal_cargo_check
 CHECK(cargo IN ('administrador','jefe_operaciones','supervisor','agente','administrativo'));

-- Administradores y jefes pueden conservar varias sedes; ninguna es obligatoria.
CREATE OR REPLACE FUNCTION sincronizar_sede_principal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.cargo NOT IN ('administrador','supervisor','jefe_operaciones') OR NEW.sede_id IS DISTINCT FROM OLD.sede_id) THEN
  DELETE FROM personal_sedes WHERE personal_id=NEW.id AND
   (NEW.cargo NOT IN ('administrador','supervisor','jefe_operaciones') OR sede_id=OLD.sede_id);
 END IF;
 IF NEW.sede_id IS NOT NULL THEN
  INSERT INTO personal_sedes VALUES(NEW.id,NEW.sede_id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;

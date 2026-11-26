-- Las cuentas eliminadas conservan identidad e historial, pero no reservan el
-- correo para siempre. La unicidad se aplica a las cuentas vigentes.
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_correo_key;
CREATE UNIQUE INDEX uidx_usuarios_correo_activo
 ON usuarios(lower(btrim(correo))) WHERE NOT eliminado;
UPDATE usuarios SET correo=lower(btrim(correo)),actualizado_en=NOW()
 WHERE NOT eliminado AND correo IS DISTINCT FROM lower(btrim(correo));

-- Una cuenta vigente no puede representar simultáneamente a dos personas.
CREATE UNIQUE INDEX uidx_personal_usuario_activo
 ON personal(usuario_id) WHERE NOT eliminado AND usuario_id IS NOT NULL;

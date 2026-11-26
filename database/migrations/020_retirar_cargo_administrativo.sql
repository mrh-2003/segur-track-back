-- Un único cargo de administración, con permisos de administrador y sede opcional.
UPDATE usuarios u SET rol='administrador',actualizado_en=NOW()
 FROM personal p WHERE p.usuario_id=u.id AND p.cargo='administrativo'
 AND NOT p.eliminado AND NOT u.eliminado;
UPDATE personal SET cargo='administrador',actualizado_en=NOW()
 WHERE cargo='administrativo';
ALTER TABLE personal DROP CONSTRAINT personal_cargo_check;
ALTER TABLE personal ADD CONSTRAINT personal_cargo_check
 CHECK(cargo IN ('administrador','jefe_operaciones','supervisor','agente'));

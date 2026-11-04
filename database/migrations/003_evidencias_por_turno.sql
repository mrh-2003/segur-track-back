ALTER TABLE evidencias_servicio ADD COLUMN IF NOT EXISTS turno_id INT REFERENCES turnos(id);
CREATE INDEX IF NOT EXISTS idx_evidencias_turno ON evidencias_servicio(turno_id) WHERE NOT eliminado;
CREATE OR REPLACE VIEW vw_operacion_turnos AS
 SELECT t.*, (t.fecha+t.hora_inicio) AT TIME ZONE 'America/Lima' AS inicio_programado,
 (t.fecha+t.hora_fin+CASE WHEN t.hora_fin<=t.hora_inicio THEN INTERVAL '1 day' ELSE INTERVAL '0' END) AT TIME ZONE 'America/Lima' AS fin_programado,
 (SELECT COUNT(*)::int FROM evidencias_servicio e WHERE e.turno_id=t.id AND NOT e.eliminado) AS evidencias_vinculadas,
 (SELECT COUNT(*)::int FROM evidencias_servicio e WHERE e.turno_id=t.id AND NOT e.eliminado AND e.creado_en<=t.evidencia_limite) AS evidencias_vinculadas_en_plazo
 FROM turnos t WHERE NOT t.eliminado;

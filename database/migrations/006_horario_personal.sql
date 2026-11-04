-- Horario habitual opcional; nulos representan disponibilidad sin franja fija.
ALTER TABLE personal ADD COLUMN IF NOT EXISTS horario_inicio TIME;
ALTER TABLE personal ADD COLUMN IF NOT EXISTS horario_fin TIME;
ALTER TABLE personal ADD COLUMN IF NOT EXISTS dias_laborales INT[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6];
ALTER TABLE personal ADD CONSTRAINT personal_horario_completo CHECK ((horario_inicio IS NULL) = (horario_fin IS NULL));
ALTER TABLE personal ADD CONSTRAINT personal_dias_validos CHECK (dias_laborales <@ ARRAY[0,1,2,3,4,5,6]);
CREATE INDEX IF NOT EXISTS idx_turnos_servicio_fecha_activos ON turnos(servicio_id,fecha) WHERE NOT eliminado;
CREATE INDEX IF NOT EXISTS idx_incidencias_servicio_fecha_activas ON incidencias(servicio_id,fecha_registro) WHERE NOT eliminado;
CREATE INDEX IF NOT EXISTS idx_evidencias_servicio_fecha_activas ON evidencias_servicio(servicio_id,creado_en) WHERE NOT eliminado;

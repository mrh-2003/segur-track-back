-- Evidencias fotográficas de actividades, reportes y rondas.
ALTER TABLE obligaciones_operativas ADD COLUMN IF NOT EXISTS evidencias JSONB NOT NULL DEFAULT '[]'::jsonb
 CHECK(jsonb_typeof(evidencias)='array' AND jsonb_array_length(evidencias)<=6);
ALTER TABLE rondas ADD COLUMN IF NOT EXISTS evidencias JSONB NOT NULL DEFAULT '[]'::jsonb
 CHECK(jsonb_typeof(evidencias)='array' AND jsonb_array_length(evidencias)<=6);
UPDATE obligaciones_operativas SET evidencias=jsonb_build_array(evidencia_url)
 WHERE evidencia_url IS NOT NULL AND evidencias='[]'::jsonb;

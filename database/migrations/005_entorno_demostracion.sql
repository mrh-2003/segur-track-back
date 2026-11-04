ALTER TABLE configuracion_operativa ADD COLUMN IF NOT EXISTS datos_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE configuracion_operativa ADD COLUMN IF NOT EXISTS demo_generada_en TIMESTAMPTZ;

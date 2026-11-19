ALTER TABLE evidencias_servicio
  ADD COLUMN IF NOT EXISTS conforme BOOLEAN;

CREATE TABLE IF NOT EXISTS consignas (
  id             SERIAL PRIMARY KEY,
  servicio_id    INT          NOT NULL REFERENCES servicios(id),
  descripcion    TEXT         NOT NULL,
  activo         BOOLEAN      NOT NULL DEFAULT TRUE,
  eliminado      BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado_en   TIMESTAMPTZ,
  eliminado_por  INT          REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consignas_servicio
  ON consignas(servicio_id) WHERE eliminado = FALSE;

CREATE TABLE IF NOT EXISTS verificaciones_consignas (
  id             SERIAL PRIMARY KEY,
  turno_id       INT          NOT NULL REFERENCES turnos(id),
  consigna_id    INT          NOT NULL REFERENCES consignas(id),
  cumplida       BOOLEAN      NOT NULL,
  observacion    TEXT,
  verificado_por INT          REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verificaciones_consignas_turno
  ON verificaciones_consignas(turno_id);

CREATE INDEX IF NOT EXISTS idx_verificaciones_consignas_consigna
  ON verificaciones_consignas(consigna_id);

CREATE TABLE IF NOT EXISTS rondas (
  id               SERIAL PRIMARY KEY,
  turno_id         INT          NOT NULL REFERENCES turnos(id),
  servicio_id      INT          NOT NULL REFERENCES servicios(id),
  fecha_programada TIMESTAMPTZ  NOT NULL,
  fecha_completada TIMESTAMPTZ,
  ruta             TEXT,
  observaciones    TEXT,
  estado           VARCHAR(15)  NOT NULL DEFAULT 'programada'
                   CHECK (estado IN ('programada','completada','omitida')),
  creado_por       INT          REFERENCES usuarios(id),
  eliminado        BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado_en     TIMESTAMPTZ,
  eliminado_por    INT          REFERENCES usuarios(id),
  creado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rondas_turno
  ON rondas(turno_id) WHERE eliminado = FALSE;

CREATE INDEX IF NOT EXISTS idx_rondas_servicio
  ON rondas(servicio_id) WHERE eliminado = FALSE;

CREATE INDEX IF NOT EXISTS idx_rondas_estado
  ON rondas(estado) WHERE eliminado = FALSE;

ALTER TABLE turnos
  ADD COLUMN IF NOT EXISTS rondas_requeridas  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rondas_completadas INT NOT NULL DEFAULT 0;

-- Conservar los criterios y evaluaciones históricas; agregar la nueva versión.

INSERT INTO criterios_mcda (codigo, nombre, descripcion, peso, activo) VALUES
  ('C01', 'Puntualidad y asistencia',                'Presencia a tiempo y cobertura de turnos programados',                   0.200, TRUE),
  ('C02', 'Cumplimiento de protocolos y consignas',  'Ejecución conforme de protocolos de seguridad y consignas del servicio', 0.200, TRUE),
  ('C03', 'Cumplimiento de actividades y rondas',    'Realización de actividades planificadas y rondas de vigilancia',         0.200, TRUE),
  ('C04', 'Cumplimiento de reportes operativos',     'Entrega oportuna y dentro del plazo de reportes operativos del turno',   0.200, TRUE),
  ('C05', 'Gestión de incidencias',                  'Resolución y atención dentro del plazo de las incidencias registradas',  0.200, TRUE)
ON CONFLICT(codigo) DO NOTHING;

-- Modelo de diez KPI, 18/11/2026. No inferir actividades/reportes de fotografías.
INSERT INTO modelo_operativo(codigo,nombre,peso,umbral)
SELECT 'C0'||n, nombre,
       COALESCE((SELECT peso FROM modelo_operativo WHERE codigo='C'||n),.2),
       COALESCE((SELECT umbral FROM modelo_operativo WHERE codigo='C'||n),20)
FROM (VALUES
 ('1','Puntualidad y asistencia'),
 ('2','Cumplimiento de protocolos y consignas'),
 ('3','Cumplimiento de actividades y rondas'),
 ('4','Cumplimiento de reportes operativos'),
 ('5','Gestión de incidencias')) AS d(n,nombre)
ON CONFLICT(codigo) DO UPDATE SET nombre=EXCLUDED.nombre;
DELETE FROM modelo_operativo WHERE codigo IN ('C1','C2','C3','C4','C5');

ALTER TABLE turnos ADD COLUMN IF NOT EXISTS plan_kpi_validado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE incidencias ADD COLUMN IF NOT EXISTS sla_resolucion_min INT CHECK(sla_resolucion_min>0);
ALTER TABLE configuracion_operativa
 ADD COLUMN IF NOT EXISTS resolucion_alta INT NOT NULL DEFAULT 240 CHECK(resolucion_alta>0),
 ADD COLUMN IF NOT EXISTS resolucion_media INT NOT NULL DEFAULT 1440 CHECK(resolucion_media>0),
 ADD COLUMN IF NOT EXISTS resolucion_baja INT NOT NULL DEFAULT 2880 CHECK(resolucion_baja>0);

CREATE TABLE IF NOT EXISTS obligaciones_operativas (
 id SERIAL PRIMARY KEY,
 turno_id INT NOT NULL REFERENCES turnos(id),
 tipo TEXT NOT NULL CHECK(tipo IN ('actividad','reporte')),
 descripcion TEXT NOT NULL CHECK(length(trim(descripcion))>0),
 fecha_limite TIMESTAMPTZ NOT NULL,
 fecha_completada TIMESTAMPTZ,
 creado_por INT NOT NULL REFERENCES usuarios(id),
 completado_por INT REFERENCES usuarios(id),
 eliminado BOOLEAN NOT NULL DEFAULT FALSE,
 eliminado_por INT REFERENCES usuarios(id),
 creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_obligaciones_turno ON obligaciones_operativas(turno_id) WHERE NOT eliminado;
COMMENT ON COLUMN turnos.plan_kpi_validado IS 'Supervisión confirmó el inventario de actividades, rondas y reportes, incluso si no aplica ninguno.';
COMMENT ON COLUMN incidencias.sla_resolucion_min IS 'Minutos desde fecha_registro hasta el vencimiento de resolución. NULL indica dato histórico desconocido.';
COMMENT ON TABLE obligaciones_operativas IS 'Una fila por actividad programada o reporte requerido. Exigible cuando fecha_limite <= corte; se excluyen anulados.';

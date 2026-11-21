ALTER TABLE obligaciones_operativas
 ADD COLUMN IF NOT EXISTS estado_revision TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado_revision IN ('pendiente','aprobado','observado')),
 ADD COLUMN IF NOT EXISTS revisado_por INT REFERENCES usuarios(id),
 ADD COLUMN IF NOT EXISTS fecha_revision TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS primera_entrega_en TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS version_entrega INT NOT NULL DEFAULT 1 CHECK(version_entrega>0);
UPDATE obligaciones_operativas SET primera_entrega_en=fecha_completada WHERE tipo='reporte' AND primera_entrega_en IS NULL;
CREATE TABLE IF NOT EXISTS revisiones_reportes (
 id BIGSERIAL PRIMARY KEY,
 reporte_id INT NOT NULL REFERENCES obligaciones_operativas(id),
 version_entrega INT NOT NULL,
 estado TEXT NOT NULL CHECK(estado IN ('aprobado','observado')),
 observacion TEXT,
 revisado_por INT NOT NULL REFERENCES usuarios(id),
 revisado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 fecha_entrega TIMESTAMPTZ NOT NULL,
 contenido TEXT,
 evidencias JSONB NOT NULL DEFAULT '[]'::jsonb,
 UNIQUE(reporte_id,version_entrega),
 CHECK(estado<>'observado' OR length(trim(observacion))>=3)
);
CREATE TABLE IF NOT EXISTS indicadores_bi (
 codigo TEXT PRIMARY KEY,
 nombre TEXT NOT NULL,
 unidad TEXT NOT NULL CHECK(unidad IN ('%','min','cantidad','por_1000')),
 sentido TEXT NOT NULL CHECK(sentido IN ('mayor','menor','informativo')),
 formula TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS metas_bi (
 id BIGSERIAL PRIMARY KEY,
 codigo TEXT NOT NULL REFERENCES indicadores_bi(codigo),
 valor NUMERIC CHECK(valor>=0),
 vigente_desde DATE NOT NULL,
 vigente_hasta DATE,
 actualizado_por INT REFERENCES usuarios(id),
 actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(codigo,vigente_desde),
 CHECK(vigente_hasta IS NULL OR vigente_hasta>=vigente_desde)
);

INSERT INTO indicadores_bi(codigo,nombre,unidad,sentido,formula) VALUES
('I00','Servicios activos','cantidad','informativo','Servicios con operación vigente al cierre del periodo'),
('I01','Cobertura de turnos','%','mayor','Turnos cubiertos / turnos exigibles × 100'),
('I02','Turnos descubiertos','cantidad','menor','Turnos exigibles sin presencia validada'),
('I03','Tasa de ausentismo','%','menor','Inasistencias validadas / turnos asignados exigibles con asistencia validada × 100'),
('I04','Tasa de tardanzas','%','menor','Ingresos fuera de tolerancia / turnos con asistencia validada × 100'),
('I09','Ejecución de actividades','%','mayor','Actividades completadas / actividades exigibles × 100'),
('I10','Actividades vencidas','cantidad','menor','Actividades exigibles pendientes de completar'),
('I11','Reportes entregados a tiempo','%','mayor','Reportes con primera entrega dentro del plazo / reportes exigibles × 100'),
('I12','Tasa de reportes observados','%','menor','Reportes observados al menos una vez / reportes revisados al menos una vez × 100'),
('I13','Incidencias registradas','cantidad','informativo','Cantidad de incidencias registradas en el periodo'),
('I14','Tasa de incidencias','por_1000','menor','Incidencias registradas / turnos exigibles × 1000'),
('I15','Tiempo mediano de respuesta','min','menor','Mediana de minutos entre registro y primera atención; excluye casos sin atención'),
('I16','Incidencias cerradas dentro del plazo','%','mayor','Incidencias cerradas antes del límite de resolución / incidencias con resolución exigible × 100'),
('I17','Incidencias abiertas','cantidad','menor','Incidencias del periodo que permanecen sin cierre al corte')
ON CONFLICT(codigo) DO NOTHING;
INSERT INTO metas_bi(codigo,valor,vigente_desde) VALUES
('I00',NULL,CURRENT_DATE),
('I01','98',CURRENT_DATE),
('I02','60',CURRENT_DATE),
('I03','3',CURRENT_DATE),
('I04','8',CURRENT_DATE),
('I09','95',CURRENT_DATE),
('I10','50',CURRENT_DATE),
('I11','95',CURRENT_DATE),
('I12','6',CURRENT_DATE),
('I13',NULL,CURRENT_DATE),
('I14','50',CURRENT_DATE),
('I15','20',CURRENT_DATE),
('I16','85',CURRENT_DATE),
('I17',NULL,CURRENT_DATE)
ON CONFLICT(codigo,vigente_desde) DO NOTHING;

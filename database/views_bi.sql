CREATE OR REPLACE VIEW vw_bi_cumplimiento_turnos AS
SELECT
  DATE_TRUNC('week', t.fecha)                          AS semana,
  s.nombre                                             AS servicio,
  c.nombre                                             AS cliente,
  COUNT(*)                                             AS total_turnos,
  COUNT(*) FILTER (WHERE t.estado = 'cumplido')        AS turnos_cumplidos,
  ROUND(
    COUNT(*) FILTER (WHERE t.estado = 'cumplido')::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 2
  )                                                    AS porcentaje_cumplimiento
FROM turnos t
JOIN servicios s  ON t.servicio_id  = s.id  AND s.eliminado  = FALSE
JOIN clientes c   ON s.cliente_id   = c.id  AND c.eliminado   = FALSE
WHERE t.eliminado = FALSE
GROUP BY DATE_TRUNC('week', t.fecha), s.nombre, c.nombre;

CREATE OR REPLACE VIEW vw_bi_cumplimiento_servicios AS
SELECT
  DATE_TRUNC('month', s.fecha_inicio)                      AS mes,
  c.nombre                                                  AS cliente,
  COUNT(*)                                                  AS total_servicios,
  COUNT(*) FILTER (WHERE s.estado = 'finalizado')          AS servicios_finalizados,
  COUNT(*) FILTER (WHERE s.estado IN ('en_curso','programado')) AS servicios_activos,
  ROUND(
    COUNT(*) FILTER (WHERE s.estado = 'finalizado')::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 2
  )                                                         AS porcentaje_finalizados
FROM servicios s
JOIN clientes c ON s.cliente_id = c.id AND c.eliminado = FALSE
WHERE s.eliminado = FALSE
GROUP BY DATE_TRUNC('month', s.fecha_inicio), c.nombre;

CREATE OR REPLACE VIEW vw_bi_incidencias AS
SELECT
  DATE_TRUNC('week', i.fecha_registro)                     AS semana,
  s.nombre                                                  AS servicio,
  c.nombre                                                  AS cliente,
  i.prioridad,
  i.estado,
  COUNT(*)                                                  AS cantidad,
  ROUND(
    AVG(
      EXTRACT(EPOCH FROM (COALESCE(i.fecha_atencion, NOW()) - i.fecha_registro)) / 60
    )::NUMERIC, 2
  )                                                         AS tiempo_promedio_atencion_min
FROM incidencias i
JOIN servicios s  ON i.servicio_id  = s.id  AND s.eliminado  = FALSE
JOIN clientes c   ON s.cliente_id   = c.id  AND c.eliminado   = FALSE
WHERE i.eliminado = FALSE
GROUP BY DATE_TRUNC('week', i.fecha_registro), s.nombre, c.nombre, i.prioridad, i.estado;

CREATE OR REPLACE VIEW vw_bi_incidencias_por_tipo AS
SELECT
  ti.nombre                                                 AS tipo,
  COUNT(*)                                                  AS cantidad,
  COUNT(*) FILTER (WHERE i.estado = 'cerrada')             AS cerradas,
  COUNT(*) FILTER (WHERE i.estado = 'abierta')             AS abiertas,
  COUNT(*) FILTER (WHERE i.estado = 'en_atencion')         AS en_atencion
FROM incidencias i
JOIN tipos_incidencia ti ON i.tipo_incidencia_id = ti.id AND ti.eliminado = FALSE
WHERE i.eliminado = FALSE
GROUP BY ti.nombre
ORDER BY cantidad DESC;

CREATE OR REPLACE VIEW vw_bi_desempeno_servicio AS
SELECT
  s.id                                                      AS servicio_id,
  s.nombre                                                  AS servicio,
  c.nombre                                                  AS cliente,
  ROUND(
    COUNT(t.*) FILTER (WHERE t.estado = 'cumplido')::NUMERIC
    / NULLIF(COUNT(t.*) FILTER (WHERE t.eliminado = FALSE), 0) * 100, 2
  )                                                         AS cumplimiento_turnos_pct,
  COUNT(i.*) FILTER (WHERE i.eliminado = FALSE AND i.estado != 'cerrada') AS incidencias_abiertas,
  ROUND(
    AVG(
      EXTRACT(EPOCH FROM (i.fecha_atencion - i.fecha_registro)) / 60
    ) FILTER (WHERE i.eliminado = FALSE AND i.fecha_atencion IS NOT NULL)::NUMERIC, 2
  )                                                         AS tiempo_promedio_atencion_min
FROM servicios s
JOIN clientes c ON s.cliente_id = c.id AND c.eliminado = FALSE
LEFT JOIN turnos t ON t.servicio_id = s.id AND t.eliminado = FALSE
LEFT JOIN incidencias i ON i.servicio_id = s.id AND i.eliminado = FALSE
WHERE s.eliminado = FALSE
GROUP BY s.id, s.nombre, c.nombre;

-- Se conserva el contrato de columnas de la vista histórica.
CREATE OR REPLACE VIEW vw_bi_evaluacion_multicriterio AS
SELECT em.id AS evaluacion_id,s.nombre AS servicio,c.nombre AS cliente,
 em.fecha_evaluacion,em.puntaje_global,em.nivel,
 ARRAY_AGG(cm.nombre ORDER BY ec.puntaje ASC) FILTER(WHERE ec.influye=TRUE) AS criterios_que_influyen
FROM evaluaciones_multicriterio em
JOIN servicios s ON s.id=em.servicio_id AND NOT s.eliminado
JOIN clientes c ON c.id=s.cliente_id AND NOT c.eliminado
JOIN evaluacion_criterios ec ON ec.evaluacion_id=em.id AND NOT ec.eliminado
JOIN criterios_mcda cm ON cm.id=ec.criterio_id AND NOT cm.eliminado
WHERE NOT em.eliminado
GROUP BY em.id,s.id,s.nombre,c.nombre,em.fecha_evaluacion,em.puntaje_global,em.nivel;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bi_lector') THEN
    BEGIN
      CREATE ROLE bi_lector LOGIN PASSWORD 'bi_lector_pass';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'No se pudo crear el rol bi_lector: %', SQLERRM;
    END;
  END IF;
END
$$;

CREATE OR REPLACE VIEW vw_bi_kpi_consignas AS
SELECT
  s.id                                                               AS servicio_id,
  s.nombre                                                           AS servicio,
  c.nombre                                                           AS cliente,
  DATE_TRUNC('week', vc.creado_en)                                   AS semana,
  COUNT(*)                                                           AS verificaciones_realizadas,
  COUNT(*) FILTER (WHERE vc.cumplida = TRUE)                         AS consignas_cumplidas,
  ROUND(
    COUNT(*) FILTER (WHERE vc.cumplida = TRUE)::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 2
  )                                                                  AS kpi04_consignas_pct
FROM verificaciones_consignas vc
JOIN turnos t ON t.id=vc.turno_id AND NOT t.eliminado
JOIN consignas cn    ON cn.servicio_id=t.servicio_id AND vc.consigna_id  = cn.id  AND cn.eliminado  = FALSE
JOIN servicios s     ON cn.servicio_id  = s.id   AND s.eliminado   = FALSE
JOIN clientes c      ON s.cliente_id    = c.id   AND c.eliminado   = FALSE
WHERE vc.creado_en <= NOW()
GROUP BY s.id, s.nombre, c.nombre, DATE_TRUNC('week', vc.creado_en);

CREATE OR REPLACE VIEW vw_bi_kpi_rondas AS
SELECT
  s.id                                                               AS servicio_id,
  s.nombre                                                           AS servicio,
  c.nombre                                                           AS cliente,
  DATE_TRUNC('week', r.fecha_programada)                             AS semana,
  COUNT(*)                                                           AS rondas_programadas,
  COUNT(*) FILTER (WHERE r.estado = 'completada' AND r.fecha_completada <= NOW())                    AS rondas_completadas,
  COUNT(*) FILTER (WHERE r.estado = 'omitida')                       AS rondas_omitidas,
  ROUND(
    COUNT(*) FILTER (WHERE r.estado = 'completada')::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 2
  )                                                                  AS kpi06_rondas_pct
FROM rondas r
JOIN servicios s ON r.servicio_id = s.id AND s.eliminado = FALSE
JOIN clientes c  ON s.cliente_id  = c.id AND c.eliminado = FALSE
WHERE r.eliminado = FALSE AND r.fecha_programada <= NOW()
GROUP BY s.id, s.nombre, c.nombre, DATE_TRUNC('week', r.fecha_programada);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'bi_lector') THEN
    BEGIN
      GRANT USAGE ON SCHEMA public TO bi_lector;
      GRANT SELECT ON
        vw_bi_cumplimiento_turnos,
        vw_bi_cumplimiento_servicios,
        vw_bi_incidencias,
        vw_bi_incidencias_por_tipo,
        vw_bi_desempeno_servicio,
        vw_bi_evaluacion_multicriterio,
        vw_bi_kpi_consignas,
        vw_bi_kpi_rondas
      TO bi_lector;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'No se pudieron otorgar permisos a bi_lector: %', SQLERRM;
    END;
  END IF;
END
$$;

-- Misma fuente de resultados que el monitor: sin reinterpretar las versiones anteriores.
CREATE OR REPLACE VIEW vw_bi_kpis_operativos AS
SELECT e.id AS evaluacion_id,e.servicio_id,e.version,e.creado_en,e.filtros,
 c->>'codigo' AS criterio,c->>'nombre' AS nombre,c->>'estado' AS estado,
 (c->>'tasa')::numeric AS cumplimiento,(c->>'riesgo')::numeric AS riesgo,
 (c->>'peso')::numeric AS peso,(c->>'umbral')::numeric AS umbral,
 (c->>'aporte')::numeric AS aporte,(e.resultado->>'criticidad')::numeric AS criticidad,
 c->'kpi01' AS primer_kpi,c->'kpi02' AS segundo_kpi
FROM evaluaciones_operativas e
CROSS JOIN LATERAL jsonb_array_elements(e.resultado->'criterios') c
WHERE e.version='operativo-v4';
DO $$ BEGIN
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='bi_lector') THEN
   GRANT SELECT ON vw_bi_kpis_operativos TO bi_lector;
 END IF;
END $$;

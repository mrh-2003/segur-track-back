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

CREATE OR REPLACE VIEW vw_bi_evaluacion_multicriterio AS
SELECT
  em.id                                                     AS evaluacion_id,
  s.nombre                                                  AS servicio,
  c.nombre                                                  AS cliente,
  em.fecha_evaluacion,
  em.puntaje_global,
  em.nivel,
  ARRAY_AGG(
    cm.nombre ORDER BY ec.puntaje ASC
  ) FILTER (WHERE ec.influye = TRUE)                        AS criterios_que_influyen
FROM evaluaciones_multicriterio em
JOIN servicios s ON em.servicio_id = s.id AND s.eliminado = FALSE
JOIN clientes c  ON s.cliente_id   = c.id AND c.eliminado = FALSE
JOIN evaluacion_criterios ec ON ec.evaluacion_id = em.id AND ec.eliminado = FALSE
JOIN criterios_mcda cm ON ec.criterio_id = cm.id AND cm.eliminado = FALSE
WHERE em.eliminado = FALSE
GROUP BY em.id, s.nombre, c.nombre, em.fecha_evaluacion, em.puntaje_global, em.nivel;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bi_lector') THEN
    CREATE ROLE bi_lector LOGIN PASSWORD 'bi_lector_pass';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO bi_lector;
GRANT SELECT ON
  vw_bi_cumplimiento_turnos,
  vw_bi_cumplimiento_servicios,
  vw_bi_incidencias,
  vw_bi_incidencias_por_tipo,
  vw_bi_desempeno_servicio,
  vw_bi_evaluacion_multicriterio
TO bi_lector;

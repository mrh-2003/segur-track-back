'use strict';

const pool = require('../config/db');

const obtenerIndicadores = async ({ periodo, clienteId, servicioId }) => {
  const dias = parseInt(periodo, 10) || 30;
  const condiciones = ['s.eliminado = FALSE'];
  const valores = [dias];
  let idx = 2;

  if (clienteId) { condiciones.push(`s.cliente_id = $${idx}`); valores.push(clienteId); idx++; }
  if (servicioId) { condiciones.push(`s.id = $${idx}`); valores.push(servicioId); idx++; }

  const where = condiciones.join(' AND ');

  const { rows } = await pool.query(
    `SELECT
       ROUND(
         COUNT(t.id) FILTER (WHERE t.estado = 'cumplido')::NUMERIC /
         NULLIF(COUNT(t.id) FILTER (WHERE t.eliminado = FALSE), 0) * 100, 1
       ) AS cumplimiento_turnos,
       ROUND(
         COUNT(DISTINCT s.id) FILTER (WHERE s.estado = 'finalizado')::NUMERIC /
         NULLIF(COUNT(DISTINCT s.id), 0) * 100, 1
       ) AS cumplimiento_servicios,
       COUNT(i.id) FILTER (WHERE i.estado != 'cerrada' AND i.eliminado = FALSE) AS incidencias_abiertas,
       ROUND(
         AVG(EXTRACT(EPOCH FROM (i.fecha_atencion - i.fecha_registro)) / 60)
         FILTER (WHERE i.fecha_atencion IS NOT NULL AND i.eliminado = FALSE)::NUMERIC, 1
       ) AS tiempo_promedio_atencion
     FROM servicios s
     LEFT JOIN turnos t ON t.servicio_id = s.id
       AND t.fecha >= CURRENT_DATE - ($1 || ' days')::INTERVAL
     LEFT JOIN incidencias i ON i.servicio_id = s.id
       AND i.fecha_registro >= NOW() - ($1 || ' days')::INTERVAL
     WHERE ${where}`,
    valores
  );
  return rows[0];
};

const obtenerEvolucionCumplimiento = async () => {
  const { rows } = await pool.query(`
    SELECT
      DATE_TRUNC('week', t.fecha) AS semana,
      ROUND(
        COUNT(*) FILTER (WHERE t.estado = 'cumplido')::NUMERIC /
        NULLIF(COUNT(*), 0) * 100, 1
      ) AS turnos_pct,
      ROUND(
        (SELECT COUNT(*) FILTER (WHERE s2.estado = 'finalizado')::NUMERIC /
         NULLIF(COUNT(*), 0) * 100
         FROM servicios s2
         WHERE s2.eliminado = FALSE
           AND DATE_TRUNC('week', s2.fecha_inicio) = DATE_TRUNC('week', t.fecha)
        ), 1
      ) AS servicios_pct
    FROM turnos t
    WHERE t.eliminado = FALSE
      AND t.fecha >= CURRENT_DATE - INTERVAL '12 weeks'
    GROUP BY DATE_TRUNC('week', t.fecha)
    ORDER BY semana
  `);
  return rows;
};

const obtenerIncidenciasPorTipo = async () => {
  const { rows } = await pool.query(`
    SELECT ti.nombre AS tipo, COUNT(*) AS cantidad
    FROM incidencias i
    JOIN tipos_incidencia ti ON i.tipo_incidencia_id = ti.id
    WHERE i.eliminado = FALSE
    GROUP BY ti.nombre
    ORDER BY cantidad DESC
  `);
  return rows;
};

const obtenerDesempenoPorServicio = async () => {
  const { rows } = await pool.query(`
    SELECT
      s.nombre AS servicio,
      ROUND(
        COUNT(t.id) FILTER (WHERE t.estado = 'cumplido')::NUMERIC /
        NULLIF(COUNT(t.id), 0) * 100, 1
      ) AS cumplimiento_pct,
      COUNT(i.id) FILTER (WHERE i.estado != 'cerrada' AND i.eliminado = FALSE) AS incidencias,
      ROUND(
        AVG(EXTRACT(EPOCH FROM (i.fecha_atencion - i.fecha_registro)) / 60)
        FILTER (WHERE i.fecha_atencion IS NOT NULL AND i.eliminado = FALSE)::NUMERIC, 1
      ) AS tiempo_prom_atencion
    FROM servicios s
    LEFT JOIN turnos t ON t.servicio_id = s.id AND t.eliminado = FALSE
    LEFT JOIN incidencias i ON i.servicio_id = s.id
    WHERE s.eliminado = FALSE
    GROUP BY s.id, s.nombre
    ORDER BY cumplimiento_pct DESC NULLS LAST
    LIMIT 10
  `);
  return rows;
};

module.exports = { obtenerIndicadores, obtenerEvolucionCumplimiento, obtenerIncidenciasPorTipo, obtenerDesempenoPorServicio };

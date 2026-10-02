'use strict';

const pool = require('../config/db');

const obtenerResumen = async () => {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM personal WHERE eliminado = FALSE AND estado = 'activo') AS personal_activo,
      (SELECT COUNT(*) FROM servicios WHERE eliminado = FALSE AND estado = 'en_curso') AS servicios_en_curso,
      (SELECT COUNT(*) FROM incidencias WHERE eliminado = FALSE AND estado != 'cerrada') AS incidencias_abiertas,
      (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (fecha_atencion - fecha_registro)) / 60)::NUMERIC, 1)
       FROM incidencias WHERE eliminado = FALSE AND fecha_atencion IS NOT NULL) AS tiempo_prom_atencion,
      (SELECT COUNT(*) FROM personal WHERE eliminado = FALSE AND estado = 'activo'
       AND creado_en >= NOW() - INTERVAL '7 days') AS personal_nuevo_semana,
      (SELECT COUNT(*) FROM servicios WHERE eliminado = FALSE AND estado = 'en_curso'
       AND creado_en >= NOW() - INTERVAL '7 days') AS servicios_nuevos_semana,
      (SELECT COUNT(*) FROM incidencias WHERE eliminado = FALSE AND estado != 'cerrada'
       AND fecha_registro >= NOW() - INTERVAL '1 day') AS incidencias_ayer
  `);
  return rows[0];
};

const obtenerActividadOperativa = async () => {
  const { rows } = await pool.query(`
    SELECT
      DATE_TRUNC('hour', creado_en) AS hora,
      COUNT(*) AS eventos
    FROM actividad_reciente
    WHERE creado_en >= NOW() - INTERVAL '24 hours'
    GROUP BY DATE_TRUNC('hour', creado_en)
    ORDER BY hora
  `);
  return rows;
};

const obtenerActividadReciente = async () => {
  const { rows } = await pool.query(
    `SELECT tipo, descripcion, creado_en
     FROM actividad_reciente ORDER BY creado_en DESC LIMIT 10`
  );
  return rows;
};

module.exports = { obtenerResumen, obtenerActividadOperativa, obtenerActividadReciente };

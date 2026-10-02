'use strict';

const pool = require('../config/db');

const listarPorSemana = async ({ desde, hasta, sedeId }) => {
  const condiciones = ['t.eliminado = FALSE', 't.fecha BETWEEN $1 AND $2'];
  const valores = [desde, hasta];
  let idx = 3;

  if (sedeId) {
    condiciones.push(`t.sede_id = $${idx}`);
    valores.push(sedeId);
    idx++;
  }

  const { rows } = await pool.query(
    `SELECT t.id, TO_CHAR(t.fecha, 'YYYY-MM-DD') AS fecha,
            t.hora_inicio, t.hora_fin, t.estado, t.relevo_pendiente,
            t.personal_id, t.servicio_id, t.sede_id,
            CONCAT(p.nombres, ' ', p.apellidos) AS personal,
            s.nombre AS servicio
     FROM turnos t
     JOIN personal p ON t.personal_id = p.id AND p.eliminado = FALSE
     JOIN servicios s ON t.servicio_id = s.id AND s.eliminado = FALSE
     WHERE ${condiciones.join(' AND ')}
     ORDER BY p.apellidos, p.nombres, t.fecha`,
    valores
  );
  return rows;
};

const obtenerResumen = async () => {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE estado = 'programado') AS programados,
      COUNT(*) FILTER (WHERE estado = 'cumplido')   AS cumplidos,
      COUNT(*) FILTER (WHERE estado IN ('pendiente','sin_confirmar')) AS pendientes,
      COUNT(*) AS total,
      ROUND(
        COUNT(*) FILTER (WHERE estado = 'cumplido')::NUMERIC /
        NULLIF(COUNT(*) FILTER (WHERE estado IN ('cumplido','pendiente','programado','confirmado','sin_confirmar')), 0) * 100, 1
      ) AS cobertura
    FROM turnos WHERE eliminado = FALSE
      AND fecha BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE
  `);
  return rows[0];
};

const obtenerAlertas = async () => {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE estado = 'sin_confirmar') AS sin_confirmar,
      COUNT(*) FILTER (WHERE relevo_pendiente = TRUE)  AS relevo_pendiente,
      COUNT(*) FILTER (WHERE estado = 'pendiente')     AS pendientes
    FROM turnos
    WHERE eliminado = FALSE AND fecha = CURRENT_DATE
  `);
  return rows[0];
};

const crear = async ({ personalId, servicioId, sedeId, fecha, horaInicio, horaFin, estado }) => {
  const { rows } = await pool.query(
    `INSERT INTO turnos (personal_id, servicio_id, sede_id, fecha, hora_inicio, hora_fin, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [personalId, servicioId, sedeId, fecha, horaInicio, horaFin, estado || 'programado']
  );
  return rows[0];
};

const verificarSolapamiento = async ({ personalId, fecha, horaInicio, horaFin, excluirId }) => {
  const { rows } = await pool.query(
    `SELECT id FROM turnos
     WHERE personal_id = $1 AND fecha = $2 AND eliminado = FALSE
       AND ($3::time, $4::time) OVERLAPS (hora_inicio, hora_fin)
       ${excluirId ? `AND id != ${excluirId}` : ''}`,
    [personalId, fecha, horaInicio, horaFin]
  );
  return rows.length > 0;
};

const actualizar = async (id, { personalId, servicioId, sedeId, fecha, horaInicio, horaFin, estado }) => {
  const { rows } = await pool.query(
    `UPDATE turnos
     SET personal_id = $1, servicio_id = $2, sede_id = $3, fecha = $4,
         hora_inicio = $5, hora_fin = $6, estado = $7, actualizado_en = NOW()
     WHERE id = $8 AND eliminado = FALSE RETURNING *`,
    [personalId, servicioId, sedeId, fecha, horaInicio, horaFin, estado, id]
  );
  return rows[0] || null;
};

const confirmar = async (id) => {
  const { rows } = await pool.query(
    `UPDATE turnos SET estado = 'confirmado', actualizado_en = NOW()
     WHERE id = $1 AND eliminado = FALSE RETURNING *`,
    [id]
  );
  return rows[0] || null;
};

const eliminar = async (id, eliminadoPor) => {
  const { rows } = await pool.query(
    `UPDATE turnos
     SET eliminado = TRUE, eliminado_en = NOW(), eliminado_por = $1, actualizado_en = NOW()
     WHERE id = $2 AND eliminado = FALSE RETURNING id`,
    [eliminadoPor, id]
  );
  return rows[0] || null;
};

const listarSedes = async () => {
  const { rows } = await pool.query(
    'SELECT id, nombre FROM sedes WHERE eliminado = FALSE ORDER BY nombre'
  );
  return rows;
};

module.exports = {
  listarPorSemana, obtenerResumen, obtenerAlertas,
  crear, verificarSolapamiento, actualizar, confirmar, eliminar, listarSedes,
};

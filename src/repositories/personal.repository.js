'use strict';

const pool = require('../config/db');

const listar = async ({ limite, offset, q, estado }) => {
  const condiciones = ['p.eliminado = FALSE'];
  const valores = [];
  let idx = 1;

  if (q) {
    condiciones.push(`(p.nombres ILIKE $${idx} OR p.apellidos ILIKE $${idx} OR p.documento ILIKE $${idx})`);
    valores.push(`%${q}%`);
    idx++;
  }
  if (estado) {
    condiciones.push(`p.estado = $${idx}`);
    valores.push(estado);
    idx++;
  }

  const where = condiciones.join(' AND ');

  const { rows: [{ total }] } = await pool.query(
    `SELECT COUNT(*) AS total FROM personal p WHERE ${where}`,
    valores
  );

  const { rows } = await pool.query(
    `SELECT p.id, p.nombres, p.apellidos, p.documento, p.cargo, p.estado,
            s.nombre AS sede,
            (
              SELECT t.hora_inicio || '-' || t.hora_fin
              FROM turnos t
              WHERE t.personal_id = p.id
                AND t.fecha = CURRENT_DATE
                AND t.eliminado = FALSE
              LIMIT 1
            ) AS turno_actual
     FROM personal p
     JOIN sedes s ON p.sede_id = s.id
     WHERE ${where}
     ORDER BY p.apellidos, p.nombres
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...valores, limite, offset]
  );

  return { filas: rows, total: parseInt(total, 10) };
};

const obtenerResumen = async () => {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE estado = 'activo')   AS activos,
      COUNT(*) FILTER (WHERE estado = 'inactivo') AS inactivos,
      COUNT(*) FILTER (WHERE cargo = 'supervisor') AS supervisores,
      COUNT(*) FILTER (WHERE cargo = 'agente')     AS agentes
    FROM personal
    WHERE eliminado = FALSE
  `);
  return rows[0];
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(
    `SELECT p.*, s.nombre AS sede
     FROM personal p
     JOIN sedes s ON p.sede_id = s.id
     WHERE p.id = $1 AND p.eliminado = FALSE`,
    [id]
  );
  return rows[0] || null;
};

const crear = async ({ nombres, apellidos, documento, cargo, estado, sedeId, usuarioId }) => {
  const { rows } = await pool.query(
    `INSERT INTO personal (nombres, apellidos, documento, cargo, estado, sede_id, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [nombres, apellidos, documento, cargo, estado || 'activo', sedeId, usuarioId || null]
  );
  return rows[0];
};

const actualizar = async (id, { nombres, apellidos, documento, cargo, estado, sedeId }) => {
  const { rows } = await pool.query(
    `UPDATE personal
     SET nombres = $1, apellidos = $2, documento = $3, cargo = $4, estado = $5,
         sede_id = $6, actualizado_en = NOW()
     WHERE id = $7 AND eliminado = FALSE RETURNING *`,
    [nombres, apellidos, documento, cargo, estado, sedeId, id]
  );
  return rows[0] || null;
};

const cambiarEstado = async (id, estado) => {
  const { rows } = await pool.query(
    `UPDATE personal SET estado = $1, actualizado_en = NOW()
     WHERE id = $2 AND eliminado = FALSE RETURNING *`,
    [estado, id]
  );
  return rows[0] || null;
};

const eliminar = async (id, eliminadoPor) => {
  const { rows } = await pool.query(
    `UPDATE personal
     SET eliminado = TRUE, eliminado_en = NOW(), eliminado_por = $1, actualizado_en = NOW()
     WHERE id = $2 AND eliminado = FALSE RETURNING id`,
    [eliminadoPor, id]
  );
  return rows[0] || null;
};

module.exports = { listar, obtenerResumen, obtenerPorId, crear, actualizar, cambiarEstado, eliminar };

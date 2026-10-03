'use strict';

const pool = require('../config/db');

const listar = async () => {
  const { rows } = await pool.query(
    `SELECT id, tipo, categoria, formato, estado, creado_en AS ultima_actualizacion
     FROM reportes_generados WHERE eliminado = FALSE ORDER BY id ASC`
  );
  return rows;
};

const historial = async (limite = 10) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.tipo, r.formato, r.estado, r.creado_en,
            u.nombre AS generado_por
     FROM reportes_generados r
     JOIN usuarios u ON r.generado_por = u.id
     WHERE r.eliminado = FALSE
     ORDER BY r.id ASC LIMIT $1`,
    [limite]
  );
  return rows;
};

const crear = async ({ tipo, categoria, formato, generadoPor }) => {
  const { rows } = await pool.query(
    `INSERT INTO reportes_generados (tipo, categoria, formato, estado, generado_por)
     VALUES ($1, $2, $3, 'completado', $4) RETURNING *`,
    [tipo, categoria, formato, generadoPor]
  );
  return rows[0];
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(
    'SELECT * FROM reportes_generados WHERE id = $1 AND eliminado = FALSE',
    [id]
  );
  return rows[0] || null;
};

module.exports = { listar, historial, crear, obtenerPorId };

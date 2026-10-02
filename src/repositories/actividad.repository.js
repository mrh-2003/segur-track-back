'use strict';

const pool = require('../config/db');

const registrar = async ({ tipo, descripcion, usuarioId }) => {
  await pool.query(
    'INSERT INTO actividad_reciente (tipo, descripcion, usuario_id) VALUES ($1, $2, $3)',
    [tipo, descripcion, usuarioId || null]
  );
};

const listar = async (limite = 10) => {
  const { rows } = await pool.query(
    'SELECT tipo, descripcion, creado_en FROM actividad_reciente ORDER BY creado_en DESC LIMIT $1',
    [limite]
  );
  return rows;
};

module.exports = { registrar, listar };

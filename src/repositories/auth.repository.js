'use strict';

const pool = require('../config/db');

const buscarPorCorreo = async (correo) => {
  const { rows } = await pool.query(
    'SELECT id, nombre, correo, clave_hash, rol, activo FROM usuarios WHERE correo = $1 AND eliminado = FALSE',
    [correo]
  );
  return rows[0] || null;
};

const buscarPorId = async (id) => {
  const { rows } = await pool.query(
    'SELECT id, nombre, correo, rol, activo FROM usuarios WHERE id = $1 AND eliminado = FALSE',
    [id]
  );
  return rows[0] || null;
};

module.exports = { buscarPorCorreo, buscarPorId };

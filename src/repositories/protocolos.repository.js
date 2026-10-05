'use strict';

const pool = require('../config/db');

const listar = async ({ q, activo } = {}) => {
  const condiciones = ['eliminado = FALSE'];
  const params = [];
  let idx = 1;

  if (q) {
    condiciones.push(`(nombre ILIKE $${idx} OR codigo ILIKE $${idx} OR descripcion ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }

  if (activo !== undefined && activo !== null && activo !== '') {
    condiciones.push(`activo = $${idx}`);
    params.push(activo === 'true' || activo === true);
    idx++;
  }

  const where = condiciones.join(' AND ');
  const { rows } = await pool.query(
    `SELECT id, codigo, nombre, descripcion, actividades, activo, creado_en, actualizado_en
     FROM protocolos
     WHERE ${where}
     ORDER BY codigo ASC`,
    params
  );
  return rows;
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(
    `SELECT id, codigo, nombre, descripcion, actividades, activo, creado_en, actualizado_en
     FROM protocolos
     WHERE id = $1 AND eliminado = FALSE`,
    [id]
  );
  return rows[0] || null;
};

const buscarPorCodigo = async (codigo, excluirId = null) => {
  const condiciones = ['codigo = $1', 'eliminado = FALSE'];
  const params = [codigo];

  if (excluirId) {
    condiciones.push('id != $2');
    params.push(excluirId);
  }

  const { rows } = await pool.query(
    `SELECT id, codigo FROM protocolos WHERE ${condiciones.join(' AND ')}`,
    params
  );
  return rows[0] || null;
};

const crear = async ({ codigo, nombre, descripcion, actividades, activo = true }) => {
  const { rows } = await pool.query(
    `INSERT INTO protocolos (codigo, nombre, descripcion, actividades, activo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, codigo, nombre, descripcion, actividades, activo, creado_en, actualizado_en`,
    [codigo.trim().toUpperCase(), nombre.trim(), descripcion ? descripcion.trim() : null, actividades ? actividades.trim() : null, activo]
  );
  return rows[0];
};

const actualizar = async (id, { codigo, nombre, descripcion, actividades, activo }) => {
  const { rows } = await pool.query(
    `UPDATE protocolos
     SET codigo = $1, nombre = $2, descripcion = $3, actividades = $4, activo = $5, actualizado_en = NOW()
     WHERE id = $6 AND eliminado = FALSE
     RETURNING id, codigo, nombre, descripcion, actividades, activo, creado_en, actualizado_en`,
    [codigo.trim().toUpperCase(), nombre.trim(), descripcion ? descripcion.trim() : null, actividades ? actividades.trim() : null, activo, id]
  );
  return rows[0] || null;
};

const eliminar = async (id, eliminadoPor) => {
  const { rows } = await pool.query(
    `UPDATE protocolos
     SET eliminado = TRUE, eliminado_en = NOW(), eliminado_por = $1, actualizado_en = NOW()
     WHERE id = $2 AND eliminado = FALSE
     RETURNING id`,
    [eliminadoPor, id]
  );
  return rows[0] || null;
};

module.exports = {
  listar,
  obtenerPorId,
  buscarPorCodigo,
  crear,
  actualizar,
  eliminar,
};

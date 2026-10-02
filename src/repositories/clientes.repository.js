'use strict';

const pool = require('../config/db');

const listar = async ({ limite = 50, offset = 0, q } = {}) => {
  const condiciones = ['eliminado = FALSE'];
  const valores = [];
  let idx = 1;

  if (q) {
    condiciones.push(`(nombre ILIKE $${idx} OR contacto ILIKE $${idx})`);
    valores.push(`%${q}%`);
    idx++;
  }

  const where = condiciones.join(' AND ');

  const { rows: [{ total }] } = await pool.query(
    `SELECT COUNT(*) AS total FROM clientes WHERE ${where}`,
    valores
  );

  const { rows } = await pool.query(
    `SELECT c.id, c.nombre, c.contacto, c.creado_en,
            (SELECT COUNT(*) FROM servicios s WHERE s.cliente_id = c.id AND s.eliminado = FALSE) AS servicios_total,
            (SELECT COUNT(*) FROM servicios s WHERE s.cliente_id = c.id AND s.estado = 'en_curso' AND s.eliminado = FALSE) AS servicios_activos
     FROM clientes c
     WHERE ${where}
     ORDER BY c.nombre
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...valores, limite, offset]
  );

  return { filas: rows, total: parseInt(total, 10) };
};

const obtenerResumen = async () => {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(DISTINCT s.id) FILTER (WHERE s.eliminado = FALSE AND s.estado = 'en_curso') AS servicios_activos,
      COUNT(DISTINCT s.id) FILTER (WHERE s.eliminado = FALSE AND s.estado = 'finalizado') AS servicios_finalizados
    FROM clientes c
    LEFT JOIN servicios s ON s.cliente_id = c.id
    WHERE c.eliminado = FALSE
  `);
  return rows[0];
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(
    `SELECT c.*,
            (SELECT COUNT(*) FROM servicios s WHERE s.cliente_id = c.id AND s.eliminado = FALSE) AS servicios_total,
            (SELECT COUNT(*) FROM servicios s WHERE s.cliente_id = c.id AND s.estado = 'en_curso' AND s.eliminado = FALSE) AS servicios_activos
     FROM clientes c
     WHERE c.id = $1 AND c.eliminado = FALSE`,
    [id]
  );
  return rows[0] || null;
};

const crear = async ({ nombre, contacto }) => {
  const { rows } = await pool.query(
    `INSERT INTO clientes (nombre, contacto)
     VALUES ($1, $2) RETURNING *`,
    [nombre.trim(), contacto ? contacto.trim() : null]
  );
  return rows[0];
};

const actualizar = async (id, { nombre, contacto }) => {
  const { rows } = await pool.query(
    `UPDATE clientes
     SET nombre = $1, contacto = $2, actualizado_en = NOW()
     WHERE id = $3 AND eliminado = FALSE RETURNING *`,
    [nombre.trim(), contacto ? contacto.trim() : null, id]
  );
  return rows[0] || null;
};

const eliminar = async (id, eliminadoPor) => {
  const { rows } = await pool.query(
    `UPDATE clientes
     SET eliminado = TRUE, eliminado_en = NOW(), eliminado_por = $1, actualizado_en = NOW()
     WHERE id = $2 AND eliminado = FALSE RETURNING id`,
    [eliminadoPor, id]
  );
  return rows[0] || null;
};

module.exports = {
  listar,
  obtenerResumen,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
};

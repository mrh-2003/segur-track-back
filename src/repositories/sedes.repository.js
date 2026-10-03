'use strict';

const pool = require('../config/db');

const listar = async ({ limite = 50, offset = 0, q } = {}) => {
  const condiciones = ['eliminado = FALSE'];
  const valores = [];
  let idx = 1;

  if (q) {
    condiciones.push(`(nombre ILIKE $${idx} OR direccion ILIKE $${idx})`);
    valores.push(`%${q}%`);
    idx++;
  }

  const where = condiciones.join(' AND ');

  const { rows: [{ total }] } = await pool.query(
    `SELECT COUNT(*) AS total FROM sedes WHERE ${where}`,
    valores
  );

  const { rows } = await pool.query(
    `SELECT s.id, s.nombre, s.direccion, s.creado_en,
            (SELECT COUNT(*) FROM personal p WHERE p.sede_id = s.id AND p.eliminado = FALSE) AS personal_total,
            (SELECT COUNT(*) FROM servicios srv WHERE srv.sede_id = s.id AND srv.eliminado = FALSE) AS servicios_total
     FROM sedes s
     WHERE ${where}
     ORDER BY s.nombre
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...valores, limite, offset]
  );

  return { filas: rows, total: parseInt(total, 10) };
};

const obtenerResumen = async () => {
  const { rows } = await pool.query(`
    SELECT
      COUNT(DISTINCT s.id) AS total,
      COUNT(DISTINCT p.id) FILTER (WHERE p.eliminado = FALSE) AS total_personal,
      COUNT(DISTINCT srv.id) FILTER (WHERE srv.eliminado = FALSE AND srv.estado = 'en_curso') AS servicios_activos
    FROM sedes s
    LEFT JOIN personal p ON p.sede_id = s.id
    LEFT JOIN servicios srv ON srv.sede_id = s.id
    WHERE s.eliminado = FALSE
  `);
  return rows[0];
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(
    `SELECT s.*,
            (SELECT COUNT(*) FROM personal p WHERE p.sede_id = s.id AND p.eliminado = FALSE) AS personal_total,
            (SELECT COUNT(*) FROM servicios srv WHERE srv.sede_id = s.id AND srv.eliminado = FALSE) AS servicios_total
     FROM sedes s
     WHERE s.id = $1 AND s.eliminado = FALSE`,
    [id]
  );
  return rows[0] || null;
};

const crear = async ({ nombre, direccion }) => {
  const { rows } = await pool.query(
    `INSERT INTO sedes (nombre, direccion)
     VALUES ($1, $2) RETURNING *`,
    [nombre.trim(), direccion ? direccion.trim() : null]
  );
  return rows[0];
};

const actualizar = async (id, { nombre, direccion }) => {
  const { rows } = await pool.query(
    `UPDATE sedes
     SET nombre = $1, direccion = $2, actualizado_en = NOW()
     WHERE id = $3 AND eliminado = FALSE RETURNING *`,
    [nombre.trim(), direccion ? direccion.trim() : null, id]
  );
  return rows[0] || null;
};

const eliminar = async (id, eliminadoPor) => {
  const { rows } = await pool.query(
    `UPDATE sedes
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

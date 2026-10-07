'use strict';

const pool = require('../config/db');

const listar = async ({ limite, offset, q, rol, activo }) => {
  const condiciones = ['u.eliminado = FALSE'];
  const valores = [];
  let idx = 1;

  if (q) {
    condiciones.push(`(u.nombre ILIKE $${idx} OR u.correo ILIKE $${idx})`);
    valores.push(`%${q}%`);
    idx++;
  }
  if (rol) {
    condiciones.push(`u.rol = $${idx}`);
    valores.push(rol);
    idx++;
  }
  if (activo !== undefined && activo !== '') {
    condiciones.push(`u.activo = $${idx}`);
    valores.push(activo === 'true' || activo === true);
    idx++;
  }

  const where = condiciones.join(' AND ');

  const { rows: [{ total }] } = await pool.query(
    `SELECT COUNT(*) AS total FROM usuarios u WHERE ${where}`,
    valores
  );

  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.correo, u.rol, u.activo, u.creado_en,
            p.id AS personal_id, p.nombres, p.apellidos, p.cargo, p.documento
     FROM usuarios u
     LEFT JOIN personal p ON p.usuario_id = u.id AND p.eliminado = FALSE
     WHERE ${where}
     ORDER BY u.nombre ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...valores, limite, offset]
  );

  return { filas: rows, total: parseInt(total, 10) };
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.correo, u.rol, u.activo, u.creado_en,
            p.id AS personal_id, p.nombres, p.apellidos, p.cargo, p.documento
     FROM usuarios u
     LEFT JOIN personal p ON p.usuario_id = u.id AND p.eliminado = FALSE
     WHERE u.id = $1 AND u.eliminado = FALSE`,
    [id]
  );
  return rows[0] || null;
};

const cambiarRol = async (id, rol) => {
  const { rows } = await pool.query(
    `UPDATE usuarios SET rol = $1, actualizado_en = NOW()
     WHERE id = $2 AND eliminado = FALSE RETURNING id, nombre, correo, rol, activo`,
    [rol, id]
  );
  return rows[0] || null;
};

const cambiarEstado = async (id, activo, eliminadoPor) => {
  const { rows } = await pool.query(
    `UPDATE usuarios SET activo = $1, actualizado_en = NOW()
     WHERE id = $2 AND eliminado = FALSE RETURNING id, nombre, correo, rol, activo`,
    [activo, id]
  );
  if (rows[0] && rows[0].personal_id) {
    await pool.query(
      `UPDATE personal SET estado = $1, actualizado_en = NOW() WHERE usuario_id = $2 AND eliminado = FALSE`,
      [activo ? 'activo' : 'inactivo', id]
    );
  }
  return rows[0] || null;
};

const obtenerResumen = async () => {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE activo = TRUE)  AS activos,
      COUNT(*) FILTER (WHERE activo = FALSE) AS inactivos,
      COUNT(*) FILTER (WHERE rol = 'administrador') AS administradores,
      COUNT(*) FILTER (WHERE rol = 'jefe_operaciones') AS jefes,
      COUNT(*) FILTER (WHERE rol = 'supervisor') AS supervisores,
      COUNT(*) FILTER (WHERE rol = 'operador') AS operadores
    FROM usuarios WHERE eliminado = FALSE
  `);
  return rows[0];
};

const crear = async ({ nombre, correo, claveHash, rol, activo = true }) => {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, correo, clave_hash, rol, activo, debe_cambiar_clave)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING id, nombre, correo, rol, activo, creado_en`,
    [nombre, correo.toLowerCase().trim(), claveHash, rol, activo]
  );
  return rows[0];
};

const buscarPorCorreo = async (correo) => {
  const { rows } = await pool.query(
    'SELECT id FROM usuarios WHERE correo = $1 AND eliminado = FALSE',
    [correo.toLowerCase().trim()]
  );
  return rows[0] || null;
};

module.exports = { listar, obtenerPorId, cambiarRol, cambiarEstado, obtenerResumen, crear, buscarPorCorreo };

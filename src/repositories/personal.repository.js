'use strict';

const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const listar = async ({ limite, offset, q, estado }) => {
  const condiciones = ['p.eliminado = FALSE'];
  const valores = [];
  let idx = 1;

  if (q) {
    condiciones.push(`(p.nombres ILIKE $${idx} OR p.apellidos ILIKE $${idx} OR p.documento ILIKE $${idx} OR p.correo ILIKE $${idx})`);
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
            p.correo, p.sede_id, p.usuario_id,
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

const crear = async ({ nombres, apellidos, documento, correo, cargo, estado = 'activo', sedeId, usuarioId }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let uId = usuarioId;
    const correoNormalizado = correo.trim().toLowerCase();
    const activoBool = estado === 'activo';
    const rolUsuario = cargo === 'supervisor' ? 'supervisor' : 'operador';

    if (!uId) {
      const { rows: uExistente } = await client.query(
        'SELECT id FROM usuarios WHERE correo = $1 AND eliminado = FALSE',
        [correoNormalizado]
      );

      if (uExistente.length > 0) {
        uId = uExistente[0].id;
        await client.query(
          `UPDATE usuarios
           SET nombre = $1, rol = $2, activo = $3, actualizado_en = NOW()
           WHERE id = $4`,
          [`${nombres.trim()} ${apellidos.trim()}`, rolUsuario, activoBool, uId]
        );
      } else {
        const hash = await bcrypt.hash(correoNormalizado, 10);
        const { rows: nuevoU } = await client.query(
          `INSERT INTO usuarios (nombre, correo, clave_hash, rol, activo, debe_cambiar_clave)
           VALUES ($1, $2, $3, $4, $5, TRUE)
           RETURNING id`,
          [`${nombres.trim()} ${apellidos.trim()}`, correoNormalizado, hash, rolUsuario, activoBool]
        );
        uId = nuevoU[0].id;
      }
    }

    const { rows: [nuevoP] } = await client.query(
      `INSERT INTO personal (nombres, apellidos, documento, correo, cargo, estado, sede_id, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [nombres.trim(), apellidos.trim(), documento.trim(), correoNormalizado, cargo, estado, sedeId, uId]
    );

    await client.query('COMMIT');
    return nuevoP;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const actualizar = async (id, { nombres, apellidos, documento, correo, cargo, estado, sedeId }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const correoNormalizado = correo ? correo.trim().toLowerCase() : null;

    const { rows: [p] } = await client.query(
      `UPDATE personal
       SET nombres = $1, apellidos = $2, documento = $3,
           correo = COALESCE($4, correo), cargo = $5, estado = $6,
           sede_id = $7, actualizado_en = NOW()
       WHERE id = $8 AND eliminado = FALSE RETURNING *`,
      [nombres.trim(), apellidos.trim(), documento.trim(), correoNormalizado, cargo, estado, sedeId, id]
    );

    if (p && p.usuario_id) {
      const activoBool = estado === 'activo';
      const rolUsuario = cargo === 'supervisor' ? 'supervisor' : 'operador';
      await client.query(
        `UPDATE usuarios
         SET nombre = $1, correo = COALESCE($2, correo), rol = $3, activo = $4, actualizado_en = NOW()
         WHERE id = $5`,
        [`${nombres.trim()} ${apellidos.trim()}`, correoNormalizado, rolUsuario, activoBool, p.usuario_id]
      );
    }

    await client.query('COMMIT');
    return p || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const cambiarEstado = async (id, estado) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [p] } = await client.query(
      `UPDATE personal SET estado = $1, actualizado_en = NOW()
       WHERE id = $2 AND eliminado = FALSE RETURNING *`,
      [estado, id]
    );

    if (p && p.usuario_id) {
      const activoBool = estado === 'activo';
      await client.query(
        `UPDATE usuarios SET activo = $1, actualizado_en = NOW() WHERE id = $2`,
        [activoBool, p.usuario_id]
      );
    }

    await client.query('COMMIT');
    return p || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const eliminar = async (id, eliminadoPor) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [p] } = await client.query(
      `UPDATE personal
       SET eliminado = TRUE, eliminado_en = NOW(), eliminado_por = $1, actualizado_en = NOW()
       WHERE id = $2 AND eliminado = FALSE RETURNING id, usuario_id`,
      [eliminadoPor, id]
    );

    if (p && p.usuario_id) {
      await client.query(
        `UPDATE usuarios
         SET activo = FALSE, eliminado = TRUE, eliminado_en = NOW(), eliminado_por = $1, actualizado_en = NOW()
         WHERE id = $2`,
        [eliminadoPor, p.usuario_id]
      );
    }

    await client.query('COMMIT');
    return p || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { listar, obtenerResumen, obtenerPorId, crear, actualizar, cambiarEstado, eliminar };

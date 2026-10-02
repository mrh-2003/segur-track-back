'use strict';

const pool = require('../config/db');

const buscarPorCorreo = async (correo) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.correo, u.clave_hash, u.rol, u.activo, u.debe_cambiar_clave,
            u.codigo_recuperacion, u.recuperacion_expira,
            p.id AS personal_id, p.nombres, p.apellidos
     FROM usuarios u
     LEFT JOIN personal p ON p.usuario_id = u.id AND p.eliminado = FALSE
     WHERE u.correo = $1 AND u.eliminado = FALSE`,
    [correo]
  );
  return rows[0] || null;
};

const buscarPorId = async (id) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.correo, u.rol, u.activo, u.debe_cambiar_clave,
            p.id AS personal_id, p.nombres, p.apellidos, p.documento, p.cargo
     FROM usuarios u
     LEFT JOIN personal p ON p.usuario_id = u.id AND p.eliminado = FALSE
     WHERE u.id = $1 AND u.eliminado = FALSE`,
    [id]
  );
  return rows[0] || null;
};

const actualizarPerfil = async (id, { nombre, nombres, apellidos }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [usuario] } = await client.query(
      `UPDATE usuarios
       SET nombre = $1, actualizado_en = NOW()
       WHERE id = $2 AND eliminado = FALSE
       RETURNING id, nombre, correo, rol, activo`,
      [nombre, id]
    );

    if (nombres && apellidos) {
      await client.query(
        `UPDATE personal
         SET nombres = $1, apellidos = $2, actualizado_en = NOW()
         WHERE usuario_id = $3 AND eliminado = FALSE`,
        [nombres, apellidos, id]
      );
    }

    await client.query('COMMIT');
    return usuario;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const actualizarClave = async (id, nuevaClaveHash) => {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET clave_hash = $1, debe_cambiar_clave = FALSE, actualizado_en = NOW()
     WHERE id = $2 AND eliminado = FALSE
     RETURNING id, nombre, correo, rol`,
    [nuevaClaveHash, id]
  );
  return rows[0] || null;
};

const guardarCodigoRecuperacion = async (correo, codigo, expira) => {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET codigo_recuperacion = $1, recuperacion_expira = $2, actualizado_en = NOW()
     WHERE correo = $3 AND eliminado = FALSE
     RETURNING id, nombre, correo`,
    [codigo, expira, correo]
  );
  return rows[0] || null;
};

const restablecerClaveConCodigo = async (correo, nuevaClaveHash) => {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET clave_hash = $1, debe_cambiar_clave = FALSE,
         codigo_recuperacion = NULL, recuperacion_expira = NULL,
         actualizado_en = NOW()
     WHERE correo = $2 AND eliminado = FALSE
     RETURNING id, nombre, correo, rol`,
    [nuevaClaveHash, correo]
  );
  return rows[0] || null;
};

module.exports = {
  buscarPorCorreo,
  buscarPorId,
  actualizarPerfil,
  actualizarClave,
  guardarCodigoRecuperacion,
  restablecerClaveConCodigo,
};

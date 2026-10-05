'use strict';

const pool = require('../config/db');

const listar = async ({ servicioId, protocoloId, personalId, estadoRevision, q, limite = 50, offset = 0 } = {}) => {
  const condiciones = ['e.eliminado = FALSE'];
  const params = [];
  let idx = 1;

  if (servicioId) {
    condiciones.push(`e.servicio_id = $${idx}`);
    params.push(servicioId);
    idx++;
  }

  if (protocoloId) {
    condiciones.push(`e.protocolo_id = $${idx}`);
    params.push(protocoloId);
    idx++;
  }

  if (personalId) {
    condiciones.push(`e.personal_id = $${idx}`);
    params.push(personalId);
    idx++;
  }

  if (estadoRevision) {
    condiciones.push(`e.estado_revision = $${idx}`);
    params.push(estadoRevision);
    idx++;
  }

  if (q) {
    condiciones.push(`(e.titulo ILIKE $${idx} OR e.descripcion ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }

  const where = condiciones.join(' AND ');

  const { rows: [{ total }] } = await pool.query(
    `SELECT COUNT(*) AS total FROM evidencias_servicio e WHERE ${where}`,
    params
  );

  const { rows } = await pool.query(
    `SELECT e.id, e.servicio_id, e.protocolo_id, e.personal_id,
            e.titulo, e.descripcion, e.archivo_url,
            e.estado_revision, e.observacion, e.fecha_revision,
            s.nombre AS servicio,
            pr.codigo AS protocolo_codigo, pr.nombre AS protocolo,
            CONCAT(p.nombres, ' ', p.apellidos) AS personal,
            u.nombre AS revisor,
            TO_CHAR(e.creado_en, 'YYYY-MM-DD HH24:MI') AS fecha_registro
     FROM evidencias_servicio e
     JOIN servicios s ON e.servicio_id = s.id
     LEFT JOIN protocolos pr ON e.protocolo_id = pr.id
     JOIN personal p ON e.personal_id = p.id
     LEFT JOIN usuarios u ON e.revisado_por = u.id
     WHERE ${where}
     ORDER BY e.creado_en DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limite, offset]
  );

  return { filas: rows, total: parseInt(total, 10) };
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(
    `SELECT e.id, e.servicio_id, e.protocolo_id, e.personal_id,
            e.titulo, e.descripcion, e.archivo_url,
            e.estado_revision, e.observacion, e.fecha_revision,
            s.nombre AS servicio,
            pr.codigo AS protocolo_codigo, pr.nombre AS protocolo, pr.actividades AS protocolo_actividades,
            CONCAT(p.nombres, ' ', p.apellidos) AS personal,
            u.nombre AS revisor,
            TO_CHAR(e.creado_en, 'YYYY-MM-DD HH24:MI') AS fecha_registro
     FROM evidencias_servicio e
     JOIN servicios s ON e.servicio_id = s.id
     LEFT JOIN protocolos pr ON e.protocolo_id = pr.id
     JOIN personal p ON e.personal_id = p.id
     LEFT JOIN usuarios u ON e.revisado_por = u.id
     WHERE e.id = $1 AND e.eliminado = FALSE`,
    [id]
  );
  return rows[0] || null;
};

const crear = async ({ servicioId, protocoloId, personalId, titulo, descripcion, archivoUrl }) => {
  const { rows } = await pool.query(
    `INSERT INTO evidencias_servicio (servicio_id, protocolo_id, personal_id, titulo, descripcion, archivo_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [servicioId, protocoloId || null, personalId, titulo.trim(), descripcion ? descripcion.trim() : null, archivoUrl || null]
  );
  return rows[0];
};

const revisar = async (id, { estadoRevision, observacion, revisadoPor }) => {
  const { rows } = await pool.query(
    `UPDATE evidencias_servicio
     SET estado_revision = $1, observacion = $2, revisado_por = $3, fecha_revision = NOW(), actualizado_en = NOW()
     WHERE id = $4 AND eliminado = FALSE
     RETURNING *`,
    [estadoRevision, observacion ? observacion.trim() : null, revisadoPor, id]
  );
  return rows[0] || null;
};

const eliminar = async (id, eliminadoPor) => {
  const { rows } = await pool.query(
    `UPDATE evidencias_servicio
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
  crear,
  revisar,
  eliminar,
};

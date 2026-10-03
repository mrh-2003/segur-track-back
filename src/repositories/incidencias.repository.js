'use strict';

const pool = require('../config/db');

const listar = async ({ limite, offset, q, tipoId, estado }) => {
  const condiciones = ['i.eliminado = FALSE'];
  const valores = [];
  let idx = 1;

  if (q) {
    condiciones.push(`(i.codigo ILIKE $${idx} OR i.descripcion ILIKE $${idx})`);
    valores.push(`%${q}%`);
    idx++;
  }
  if (tipoId) {
    condiciones.push(`i.tipo_incidencia_id = $${idx}`);
    valores.push(tipoId);
    idx++;
  }
  if (estado) {
    condiciones.push(`i.estado = $${idx}`);
    valores.push(estado);
    idx++;
  }

  const where = condiciones.join(' AND ');

  const { rows: [{ total }] } = await pool.query(
    `SELECT COUNT(*) AS total FROM incidencias i WHERE ${where}`,
    valores
  );

  const { rows } = await pool.query(
    `SELECT i.id, i.codigo, i.prioridad, i.estado, i.fecha_registro, i.fecha_atencion, i.fecha_cierre, i.descripcion,
            i.tipo_incidencia_id, i.servicio_id, i.personal_id, i.registrado_por,
            ti.nombre AS tipo,
            s.nombre  AS servicio,
            COALESCE(CONCAT(p.nombres, ' ', p.apellidos), u.nombre) AS personal_registra
     FROM incidencias i
     JOIN tipos_incidencia ti ON i.tipo_incidencia_id = ti.id
     JOIN servicios s ON i.servicio_id = s.id
     LEFT JOIN personal p ON i.personal_id = p.id
     LEFT JOIN usuarios u ON i.registrado_por = u.id
     WHERE ${where}
     ORDER BY i.codigo ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...valores, limite, offset]
  );

  return { filas: rows, total: parseInt(total, 10) };
};

const obtenerResumen = async () => {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE estado = 'abierta')     AS abiertas,
      COUNT(*) FILTER (WHERE estado = 'en_atencion') AS en_atencion,
      COUNT(*) FILTER (WHERE estado = 'cerrada')     AS cerradas,
      ROUND(
        AVG(EXTRACT(EPOCH FROM (fecha_atencion - fecha_registro)) / 60)
        FILTER (WHERE fecha_atencion IS NOT NULL)::NUMERIC, 1
      ) AS tiempo_promedio_atencion
    FROM incidencias WHERE eliminado = FALSE
  `);
  return rows[0];
};

const obtenerRecientes = async (limite = 5) => {
  const { rows } = await pool.query(
    `SELECT i.codigo, ti.nombre AS tipo, i.fecha_registro, i.prioridad, i.estado,
            COALESCE(CONCAT(p.nombres, ' ', p.apellidos), u.nombre) AS personal_registra
     FROM incidencias i
     JOIN tipos_incidencia ti ON i.tipo_incidencia_id = ti.id
     LEFT JOIN personal p ON i.personal_id = p.id
     LEFT JOIN usuarios u ON i.registrado_por = u.id
     WHERE i.eliminado = FALSE
     ORDER BY i.fecha_registro DESC LIMIT $1`,
    [limite]
  );
  return rows;
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(
    `SELECT i.*, ti.nombre AS tipo, s.nombre AS servicio,
            COALESCE(CONCAT(p.nombres, ' ', p.apellidos), u.nombre) AS personal_registra
     FROM incidencias i
     JOIN tipos_incidencia ti ON i.tipo_incidencia_id = ti.id
     JOIN servicios s ON i.servicio_id = s.id
     LEFT JOIN personal p ON i.personal_id = p.id
     LEFT JOIN usuarios u ON i.registrado_por = u.id
     WHERE i.id = $1 AND i.eliminado = FALSE`,
    [id]
  );
  return rows[0] || null;
};

const siguienteCodigo = async () => {
  const { rows } = await pool.query("SELECT nextval('seq_incidencias') AS num");
  return `INC-${String(rows[0].num).padStart(4, '0')}`;
};

const crear = async ({ codigo, tipoIncidenciaId, servicioId, personalId, descripcion, prioridad, registradoPor }) => {
  const { rows } = await pool.query(
    `INSERT INTO incidencias (codigo, tipo_incidencia_id, servicio_id, personal_id, descripcion, prioridad, registrado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [codigo, tipoIncidenciaId, servicioId, personalId || null, descripcion, prioridad, registradoPor]
  );
  return rows[0];
};

const actualizar = async (id, { tipoIncidenciaId, servicioId, personalId, descripcion, prioridad, estado }) => {
  const { rows } = await pool.query(
    `UPDATE incidencias
     SET tipo_incidencia_id = $1, servicio_id = $2, personal_id = COALESCE($3, personal_id),
         descripcion = $4, prioridad = $5, estado = $6, actualizado_en = NOW()
     WHERE id = $7 AND eliminado = FALSE RETURNING *`,
    [tipoIncidenciaId, servicioId, personalId || null, descripcion, prioridad, estado, id]
  );
  return rows[0] || null;
};

const cambiarEstado = async (id, estado) => {
  const ahora = new Date();
  const fechaAtencion = estado === 'en_atencion' ? ahora : undefined;
  const fechaCierre   = estado === 'cerrada'     ? ahora : undefined;

  let sql = `UPDATE incidencias SET estado = $1, actualizado_en = NOW()`;
  const valores = [estado];
  let idx = 2;

  if (fechaAtencion) { sql += `, fecha_atencion = $${idx}`; valores.push(ahora); idx++; }
  if (fechaCierre)   { sql += `, fecha_cierre = $${idx}`;   valores.push(ahora); idx++; }

  sql += ` WHERE id = $${idx} AND eliminado = FALSE RETURNING *`;
  valores.push(id);

  const { rows } = await pool.query(sql, valores);
  return rows[0] || null;
};

const eliminar = async (id, eliminadoPor) => {
  const { rows } = await pool.query(
    `UPDATE incidencias
     SET eliminado = TRUE, eliminado_en = NOW(), eliminado_por = $1, actualizado_en = NOW()
     WHERE id = $2 AND eliminado = FALSE RETURNING id`,
    [eliminadoPor, id]
  );
  return rows[0] || null;
};

const listarTipos = async () => {
  const { rows } = await pool.query(
    'SELECT id, nombre FROM tipos_incidencia WHERE eliminado = FALSE ORDER BY nombre'
  );
  return rows;
};

module.exports = {
  listar,
  obtenerResumen,
  obtenerRecientes,
  obtenerPorId,
  siguienteCodigo,
  crear,
  actualizar,
  cambiarEstado,
  eliminar,
  listarTipos,
};

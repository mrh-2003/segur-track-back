'use strict';

const pool = require('../config/db');

const listar = async ({ limite, offset, q, clienteId, estado }) => {
  const condiciones = ['s.eliminado = FALSE'];
  const valores = [];
  let idx = 1;

  if (q) {
    condiciones.push(`s.nombre ILIKE $${idx}`);
    valores.push(`%${q}%`);
    idx++;
  }
  if (clienteId) {
    condiciones.push(`s.cliente_id = $${idx}`);
    valores.push(clienteId);
    idx++;
  }
  if (estado) {
    condiciones.push(`s.estado = $${idx}`);
    valores.push(estado);
    idx++;
  }

  const where = condiciones.join(' AND ');

  const { rows: [{ total }] } = await pool.query(
    `SELECT COUNT(*) AS total FROM servicios s WHERE ${where}`,
    valores
  );

  const { rows } = await pool.query(
    `SELECT s.id, s.nombre, s.hora_inicio, s.hora_fin, s.estado, s.fecha_inicio, s.fecha_fin,
            c.id AS cliente_id, c.nombre AS cliente,
            se.nombre AS sede,
            CONCAT(p.nombres, ' ', p.apellidos) AS supervisor,
            (SELECT COUNT(*) FROM servicio_personal sp
             WHERE sp.servicio_id = s.id AND sp.eliminado = FALSE) AS personal_asignado
     FROM servicios s
     JOIN clientes c ON s.cliente_id = c.id
     JOIN sedes se   ON s.sede_id    = se.id
     JOIN personal p ON s.supervisor_id = p.id
     WHERE ${where}
     ORDER BY s.creado_en DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...valores, limite, offset]
  );

  return { filas: rows, total: parseInt(total, 10) };
};

const obtenerResumen = async () => {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE estado IN ('programado','en_curso')) AS activos,
      COUNT(*) FILTER (WHERE estado = 'finalizado')               AS finalizados,
      ROUND(
        COUNT(*) FILTER (WHERE estado = 'finalizado')::NUMERIC /
        NULLIF(COUNT(*), 0) * 100, 1
      )                                                            AS cumplimiento
    FROM servicios WHERE eliminado = FALSE
  `);
  return rows[0];
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(
    `SELECT s.*, c.nombre AS cliente, se.nombre AS sede,
            CONCAT(p.nombres, ' ', p.apellidos) AS supervisor,
            (SELECT COUNT(*) FROM servicio_personal sp
             WHERE sp.servicio_id = s.id AND sp.eliminado = FALSE) AS personal_asignado
     FROM servicios s
     JOIN clientes c ON s.cliente_id = c.id
     JOIN sedes se   ON s.sede_id    = se.id
     JOIN personal p ON s.supervisor_id = p.id
     WHERE s.id = $1 AND s.eliminado = FALSE`,
    [id]
  );
  return rows[0] || null;
};

const crear = async ({ nombre, clienteId, sedeId, supervisorId, horaInicio, horaFin, estado, fechaInicio, fechaFin }) => {
  const { rows } = await pool.query(
    `INSERT INTO servicios (nombre, cliente_id, sede_id, supervisor_id, hora_inicio, hora_fin, estado, fecha_inicio, fecha_fin)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [nombre, clienteId, sedeId, supervisorId, horaInicio, horaFin, estado || 'programado', fechaInicio, fechaFin || null]
  );
  return rows[0];
};

const actualizar = async (id, { nombre, clienteId, sedeId, supervisorId, horaInicio, horaFin, estado, fechaInicio, fechaFin }) => {
  const { rows } = await pool.query(
    `UPDATE servicios
     SET nombre = $1, cliente_id = $2, sede_id = $3, supervisor_id = $4,
         hora_inicio = $5, hora_fin = $6, estado = $7, fecha_inicio = $8, fecha_fin = $9,
         actualizado_en = NOW()
     WHERE id = $10 AND eliminado = FALSE RETURNING *`,
    [nombre, clienteId, sedeId, supervisorId, horaInicio, horaFin, estado, fechaInicio, fechaFin || null, id]
  );
  return rows[0] || null;
};

const cambiarEstado = async (id, estado) => {
  const { rows } = await pool.query(
    `UPDATE servicios SET estado = $1, actualizado_en = NOW()
     WHERE id = $2 AND eliminado = FALSE RETURNING *`,
    [estado, id]
  );
  return rows[0] || null;
};

const eliminar = async (id, eliminadoPor) => {
  const { rows } = await pool.query(
    `UPDATE servicios
     SET eliminado = TRUE, eliminado_en = NOW(), eliminado_por = $1, actualizado_en = NOW()
     WHERE id = $2 AND eliminado = FALSE RETURNING id`,
    [eliminadoPor, id]
  );
  return rows[0] || null;
};

const listarClientes = async () => {
  const { rows } = await pool.query(
    'SELECT id, nombre FROM clientes WHERE eliminado = FALSE ORDER BY nombre'
  );
  return rows;
};

module.exports = { listar, obtenerResumen, obtenerPorId, crear, actualizar, cambiarEstado, eliminar, listarClientes };

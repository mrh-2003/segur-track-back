'use strict';

const pool = require('../config/db');

const listar = async ({ limite, offset, q, clienteId, estado, supervisorId, personalId }) => {
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
  if (supervisorId) {
    condiciones.push(`s.supervisor_id = $${idx}`);
    valores.push(supervisorId);
    idx++;
  }
  if (personalId) {
    condiciones.push(`EXISTS (SELECT 1 FROM servicio_personal sp WHERE sp.servicio_id = s.id AND sp.personal_id = $${idx} AND sp.eliminado = FALSE)`);
    valores.push(personalId);
    idx++;
  }

  const where = condiciones.join(' AND ');

  const { rows: [{ total }] } = await pool.query(
    `SELECT COUNT(*) AS total FROM servicios s WHERE ${where}`,
    valores
  );

  const { rows } = await pool.query(
    `SELECT s.id, s.nombre, s.hora_inicio, s.hora_fin, s.estado,
            TO_CHAR(s.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
            TO_CHAR(s.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
            s.cliente_id, s.sede_id, s.supervisor_id,
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
     ORDER BY s.nombre ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...valores, limite, offset]
  );

  return { filas: rows, total: parseInt(total, 10) };
};

const obtenerResumen = async (supervisorId) => {
  const condiciones = ['eliminado = FALSE'];
  const params = [];
  if (supervisorId) {
    condiciones.push('supervisor_id = $1');
    params.push(supervisorId);
  }
  const where = condiciones.join(' AND ');

  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE estado IN ('programado','en_curso')) AS activos,
      COUNT(*) FILTER (WHERE estado = 'finalizado')               AS finalizados,
      ROUND(
        COUNT(*) FILTER (WHERE estado = 'finalizado')::NUMERIC /
        NULLIF(COUNT(*), 0) * 100, 1
      )                                                            AS cumplimiento
    FROM servicios WHERE ${where}
  `, params);
  return rows[0];
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.nombre, s.cliente_id, s.sede_id, s.supervisor_id,
            s.hora_inicio, s.hora_fin, s.estado,
            TO_CHAR(s.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
            TO_CHAR(s.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
            c.nombre AS cliente, se.nombre AS sede,
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

const listarProtocolos = async (servicioId) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.codigo, p.nombre, p.descripcion, p.actividades, p.activo
     FROM protocolos p
     JOIN servicio_protocolos sp ON p.id = sp.protocolo_id
     WHERE sp.servicio_id = $1 AND sp.eliminado = FALSE AND p.eliminado = FALSE
     ORDER BY p.codigo ASC`,
    [servicioId]
  );
  return rows;
};

const asociarProtocolo = async (servicioId, protocoloId) => {
  const { rows } = await pool.query(
    `INSERT INTO servicio_protocolos (servicio_id, protocolo_id, eliminado)
     VALUES ($1, $2, FALSE)
     ON CONFLICT (servicio_id, protocolo_id) WHERE eliminado = FALSE
     DO NOTHING
     RETURNING *`,
    [servicioId, protocoloId]
  );
  if (!rows[0]) {
    await pool.query(
      `UPDATE servicio_protocolos
       SET eliminado = FALSE, actualizado_en = NOW()
       WHERE servicio_id = $1 AND protocolo_id = $2`,
      [servicioId, protocoloId]
    );
  }
  return true;
};

const desasociarProtocolo = async (servicioId, protocoloId, usuarioId) => {
  const { rows } = await pool.query(
    `UPDATE servicio_protocolos
     SET eliminado = TRUE, eliminado_en = NOW(), eliminado_por = $3, actualizado_en = NOW()
     WHERE servicio_id = $1 AND protocolo_id = $2 AND eliminado = FALSE
     RETURNING id`,
    [servicioId, protocoloId, usuarioId]
  );
  return rows[0] || null;
};

const listarRequerimientos = async (servicioId) => {
  const { rows } = await pool.query(
    `SELECT id, servicio_id, titulo, descripcion, prioridad, creado_en
     FROM servicio_requerimientos
     WHERE servicio_id = $1 AND eliminado = FALSE
     ORDER BY id ASC`,
    [servicioId]
  );
  return rows;
};

const crearRequerimiento = async (servicioId, { titulo, descripcion, prioridad = 'media' }) => {
  const { rows } = await pool.query(
    `INSERT INTO servicio_requerimientos (servicio_id, titulo, descripcion, prioridad)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [servicioId, titulo.trim(), descripcion ? descripcion.trim() : null, prioridad]
  );
  return rows[0];
};

const eliminarRequerimiento = async (id, usuarioId) => {
  const { rows } = await pool.query(
    `UPDATE servicio_requerimientos
     SET eliminado = TRUE, eliminado_en = NOW(), eliminado_por = $2, actualizado_en = NOW()
     WHERE id = $1 AND eliminado = FALSE
     RETURNING id`,
    [id, usuarioId]
  );
  return rows[0] || null;
};

const listarPersonalAsignado = async (servicioId) => {
  const { rows } = await pool.query(
    `SELECT sp.id AS asignacion_id, p.id, p.nombres, p.apellidos, p.documento, p.cargo, p.estado, p.correo
     FROM personal p
     JOIN servicio_personal sp ON p.id = sp.personal_id
     WHERE sp.servicio_id = $1 AND sp.eliminado = FALSE AND p.eliminado = FALSE
     ORDER BY p.nombres ASC`,
    [servicioId]
  );
  return rows;
};

const asignarPersonal = async (servicioId, personalId, usuarioId) => {
  const { rows: [existente] } = await pool.query(
    `SELECT id, eliminado FROM servicio_personal WHERE servicio_id = $1 AND personal_id = $2`,
    [servicioId, personalId]
  );
  if (existente && !existente.eliminado) return existente;
  if (existente && existente.eliminado) {
    const { rows: [r] } = await pool.query(
      `UPDATE servicio_personal SET eliminado = FALSE, eliminado_en = NULL, eliminado_por = NULL, actualizado_en = NOW()
       WHERE id = $1 RETURNING *`,
      [existente.id]
    );
    return r;
  }
  const { rows: [r] } = await pool.query(
    `INSERT INTO servicio_personal (servicio_id, personal_id) VALUES ($1, $2) RETURNING *`,
    [servicioId, personalId]
  );
  return r;
};

const desasignarPersonal = async (asignacionId, usuarioId) => {
  const { rows } = await pool.query(
    `UPDATE servicio_personal
     SET eliminado = TRUE, eliminado_en = NOW(), eliminado_por = $2, actualizado_en = NOW()
     WHERE id = $1 AND eliminado = FALSE RETURNING id`,
    [asignacionId, usuarioId]
  );
  return rows[0] || null;
};

const listarTodasAsignaciones = async ({ servicioId, personalId, limite, offset }) => {
  const condiciones = ['sp.eliminado = FALSE', 's.eliminado = FALSE', 'p.eliminado = FALSE'];
  const valores = [];
  let idx = 1;
  if (servicioId) { condiciones.push(`sp.servicio_id = $${idx}`); valores.push(servicioId); idx++; }
  if (personalId) { condiciones.push(`sp.personal_id = $${idx}`); valores.push(personalId); idx++; }
  const where = condiciones.join(' AND ');
  const { rows: [{ total }] } = await pool.query(
    `SELECT COUNT(*) AS total FROM servicio_personal sp
     JOIN servicios s ON s.id = sp.servicio_id
     JOIN personal p ON p.id = sp.personal_id
     WHERE ${where}`, valores
  );
  const { rows } = await pool.query(
    `SELECT sp.id AS asignacion_id, s.id AS servicio_id, s.nombre AS servicio, s.estado AS estado_servicio,
            p.id AS personal_id, p.nombres, p.apellidos, p.cargo, p.documento, p.estado
     FROM servicio_personal sp
     JOIN servicios s ON s.id = sp.servicio_id
     JOIN personal p ON p.id = sp.personal_id
     WHERE ${where}
     ORDER BY s.nombre, p.nombres
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...valores, limite, offset]
  );
  return { filas: rows, total: parseInt(total, 10) };
};

module.exports = {
  listar,
  obtenerResumen,
  obtenerPorId,
  crear,
  actualizar,
  cambiarEstado,
  eliminar,
  listarClientes,
  listarProtocolos,
  asociarProtocolo,
  desasociarProtocolo,
  listarRequerimientos,
  crearRequerimiento,
  eliminarRequerimiento,
  listarPersonalAsignado,
  asignarPersonal,
  desasignarPersonal,
  listarTodasAsignaciones,
};

'use strict';

const pool = require('../config/db');

const listarMonitor = async ({ estado, sedeId, clienteId }) => {
  const condiciones = ['s.eliminado = FALSE'];
  const valores = [];
  let idx = 1;

  if (estado) {
    condiciones.push(`s.estado = $${idx}`);
    valores.push(estado);
    idx++;
  }
  if (sedeId) {
    condiciones.push(`s.sede_id = $${idx}`);
    valores.push(sedeId);
    idx++;
  }
  if (clienteId) {
    condiciones.push(`s.cliente_id = $${idx}`);
    valores.push(clienteId);
    idx++;
  }

  const where = condiciones.join(' AND ');

  const { rows } = await pool.query(
    `SELECT s.id, s.nombre, s.estado, s.hora_inicio, s.hora_fin,
            TO_CHAR(s.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
            TO_CHAR(s.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
            c.nombre AS cliente, se.nombre AS sede,
            CONCAT(p.nombres, ' ', p.apellidos) AS supervisor,
            (SELECT COUNT(*) FROM servicio_personal sp WHERE sp.servicio_id = s.id AND sp.eliminado = FALSE) AS personal_asignado,
            (SELECT COUNT(*) FROM incidencias i WHERE i.servicio_id = s.id AND i.eliminado = FALSE AND i.estado = 'abierta') AS incidencias_abiertas,
            (SELECT COUNT(*) FROM evidencias_servicio ev WHERE ev.servicio_id = s.id AND ev.eliminado = FALSE) AS evidencias_registradas,
            (SELECT COUNT(*) FROM servicio_protocolos sproc WHERE sproc.servicio_id = s.id AND sproc.eliminado = FALSE) AS protocolos_asociados
     FROM servicios s
     JOIN clientes c ON s.cliente_id = c.id
     JOIN sedes se ON s.sede_id = se.id
     JOIN personal p ON s.supervisor_id = p.id
     WHERE ${where}
     ORDER BY CASE s.estado WHEN 'en_curso' THEN 1 WHEN 'programado' THEN 2 ELSE 3 END, s.nombre`,
    valores
  );

  return rows;
};

const obtenerDetalleOperativo = async (id) => {
  const { rows: [servicio] } = await pool.query(
    `SELECT s.id, s.nombre, s.estado, s.hora_inicio, s.hora_fin,
            TO_CHAR(s.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
            TO_CHAR(s.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
            c.nombre AS cliente, se.nombre AS sede,
            CONCAT(p.nombres, ' ', p.apellidos) AS supervisor
     FROM servicios s
     JOIN clientes c ON s.cliente_id = c.id
     JOIN sedes se ON s.sede_id = se.id
     JOIN personal p ON s.supervisor_id = p.id
     WHERE s.id = $1 AND s.eliminado = FALSE`,
    [id]
  );

  if (!servicio) return null;

  const { rows: personal } = await pool.query(
    `SELECT p.id, p.nombres, p.apellidos, p.cargo, p.estado
     FROM personal p
     JOIN servicio_personal sp ON p.id = sp.personal_id
     WHERE sp.servicio_id = $1 AND sp.eliminado = FALSE AND p.eliminado = FALSE`,
    [id]
  );

  const { rows: protocolos } = await pool.query(
    `SELECT p.id, p.codigo, p.nombre, p.descripcion
     FROM protocolos p
     JOIN servicio_protocolos sp ON p.id = sp.protocolo_id
     WHERE sp.servicio_id = $1 AND sp.eliminado = FALSE AND p.eliminado = FALSE`,
    [id]
  );

  const { rows: evidencias } = await pool.query(
    `SELECT ev.id, ev.titulo, ev.descripcion, ev.estado_revision,
            ev.creado_en, pr.nombre AS protocolo,
            CONCAT(p.nombres, ' ', p.apellidos) AS personal
     FROM evidencias_servicio ev
     LEFT JOIN protocolos pr ON ev.protocolo_id = pr.id
     LEFT JOIN personal p ON ev.personal_id = p.id
     WHERE ev.servicio_id = $1 AND ev.eliminado = FALSE
     ORDER BY ev.creado_en DESC
     LIMIT 10`,
    [id]
  );

  const { rows: incidencias } = await pool.query(
    `SELECT i.id, i.codigo, i.estado, i.prioridad, i.descripcion,
            i.fecha_registro, ti.nombre AS tipo
     FROM incidencias i
     JOIN tipos_incidencia ti ON i.tipo_incidencia_id = ti.id
     WHERE i.servicio_id = $1 AND i.eliminado = FALSE
     ORDER BY i.fecha_registro DESC
     LIMIT 10`,
    [id]
  );

  return { ...servicio, personal, protocolos, evidencias, incidencias };
};

const obtenerIndicadoresOperativos = async ({ periodo = 30, servicioId, sedeId, clienteId }) => {
  const condiciones = ['s.eliminado = FALSE'];
  const valores = [parseInt(periodo, 10)];
  let idx = 2;

  if (servicioId) {
    condiciones.push(`s.id = $${idx}`);
    valores.push(servicioId);
    idx++;
  }
  if (sedeId) {
    condiciones.push(`s.sede_id = $${idx}`);
    valores.push(sedeId);
    idx++;
  }
  if (clienteId) {
    condiciones.push(`s.cliente_id = $${idx}`);
    valores.push(clienteId);
    idx++;
  }

  const where = condiciones.join(' AND ');

  const { rows: [indicadores] } = await pool.query(
    `SELECT
      COUNT(DISTINCT s.id) AS total_servicios,
      COUNT(DISTINCT s.id) FILTER (WHERE s.estado = 'en_curso') AS en_curso,
      COUNT(DISTINCT s.id) FILTER (WHERE s.estado = 'finalizado') AS finalizados,
      COUNT(DISTINCT t.id) AS total_turnos,
      COUNT(DISTINCT t.id) FILTER (WHERE t.estado = 'cumplido') AS turnos_cumplidos,
      ROUND(
        COUNT(DISTINCT t.id) FILTER (WHERE t.estado = 'cumplido')::NUMERIC /
        NULLIF(COUNT(DISTINCT t.id), 0) * 100, 1
      ) AS cumplimiento_turnos,
      COUNT(DISTINCT i.id) AS total_incidencias,
      COUNT(DISTINCT i.id) FILTER (WHERE i.estado = 'abierta') AS incidencias_abiertas,
      COUNT(DISTINCT i.id) FILTER (WHERE i.estado = 'cerrada') AS incidencias_cerradas,
      ROUND(AVG(
        EXTRACT(EPOCH FROM (i.fecha_atencion - i.fecha_registro)) / 60
      ) FILTER (WHERE i.fecha_atencion IS NOT NULL), 0) AS tiempo_prom_atencion_min,
      COUNT(DISTINCT ev.id) AS total_evidencias,
      COUNT(DISTINCT ev.id) FILTER (WHERE ev.estado_revision = 'aprobada') AS evidencias_aprobadas,
      COUNT(DISTINCT sp.personal_id) AS personal_activo
    FROM servicios s
    LEFT JOIN turnos t ON t.servicio_id = s.id AND t.eliminado = FALSE
      AND t.fecha >= CURRENT_DATE - INTERVAL '1 day' * $1
    LEFT JOIN incidencias i ON i.servicio_id = s.id AND i.eliminado = FALSE
      AND i.fecha_registro >= CURRENT_DATE - INTERVAL '1 day' * $1
    LEFT JOIN evidencias_servicio ev ON ev.servicio_id = s.id AND ev.eliminado = FALSE
      AND ev.creado_en >= CURRENT_DATE - INTERVAL '1 day' * $1
    LEFT JOIN servicio_personal sp ON sp.servicio_id = s.id AND sp.eliminado = FALSE
    WHERE ${where}`,
    valores
  );

  return indicadores;
};

const obtenerHistorialIndicadores = async ({ periodos, servicioId, sedeId, clienteId }) => {
  const meses = parseInt(periodos || 6, 10);
  const condiciones = ['s.eliminado = FALSE'];
  const valores = [meses];
  let idx = 2;

  if (servicioId) {
    condiciones.push(`s.id = $${idx}`);
    valores.push(servicioId);
    idx++;
  }
  if (sedeId) {
    condiciones.push(`s.sede_id = $${idx}`);
    valores.push(sedeId);
    idx++;
  }
  if (clienteId) {
    condiciones.push(`s.cliente_id = $${idx}`);
    valores.push(clienteId);
    idx++;
  }

  const where = condiciones.join(' AND ');

  const { rows } = await pool.query(
    `SELECT
      TO_CHAR(DATE_TRUNC('month', t.fecha), 'YYYY-MM') AS periodo,
      TO_CHAR(DATE_TRUNC('month', t.fecha), 'Mon YYYY') AS etiqueta,
      ROUND(
        COUNT(t.id) FILTER (WHERE t.estado = 'cumplido')::NUMERIC /
        NULLIF(COUNT(t.id), 0) * 100, 1
      ) AS cumplimiento_turnos,
      COUNT(DISTINCT i.id) FILTER (WHERE i.estado != 'cerrada') AS incidencias_abiertas,
      COUNT(DISTINCT i.id) FILTER (WHERE i.estado = 'cerrada') AS incidencias_cerradas,
      ROUND(AVG(
        EXTRACT(EPOCH FROM (i.fecha_atencion - i.fecha_registro)) / 60
      ) FILTER (WHERE i.fecha_atencion IS NOT NULL), 0) AS tiempo_prom_atencion
    FROM servicios s
    LEFT JOIN turnos t ON t.servicio_id = s.id AND t.eliminado = FALSE
      AND t.fecha >= DATE_TRUNC('month', CURRENT_DATE) - ($1 || ' months')::INTERVAL
    LEFT JOIN incidencias i ON i.servicio_id = s.id AND i.eliminado = FALSE
      AND i.fecha_registro >= DATE_TRUNC('month', CURRENT_DATE) - ($1 || ' months')::INTERVAL
    WHERE ${where}
    GROUP BY DATE_TRUNC('month', t.fecha)
    ORDER BY 1`,
    valores
  );

  return rows;
};

const obtenerIndicadoresPorServicio = async ({ periodo = 30, clienteId, sedeId }) => {
  const condiciones = ['s.eliminado = FALSE'];
  const valores = [parseInt(periodo, 10)];
  let idx = 2;

  if (clienteId) {
    condiciones.push(`s.cliente_id = $${idx}`);
    valores.push(clienteId);
    idx++;
  }
  if (sedeId) {
    condiciones.push(`s.sede_id = $${idx}`);
    valores.push(sedeId);
    idx++;
  }

  const where = condiciones.join(' AND ');

  const { rows } = await pool.query(
    `SELECT
      s.id, s.nombre, s.estado,
      c.nombre AS cliente,
      ROUND(
        COUNT(t.id) FILTER (WHERE t.estado = 'cumplido')::NUMERIC /
        NULLIF(COUNT(t.id), 0) * 100, 1
      ) AS cumplimiento_turnos,
      COUNT(DISTINCT i.id) FILTER (WHERE i.estado = 'abierta') AS incidencias_abiertas,
      COUNT(DISTINCT ev.id) AS evidencias,
      ROUND(AVG(
        EXTRACT(EPOCH FROM (i2.fecha_atencion - i2.fecha_registro)) / 60
      ) FILTER (WHERE i2.fecha_atencion IS NOT NULL), 0) AS tiempo_prom_atencion
    FROM servicios s
    JOIN clientes c ON s.cliente_id = c.id
    LEFT JOIN turnos t ON t.servicio_id = s.id AND t.eliminado = FALSE
      AND t.fecha >= CURRENT_DATE - INTERVAL '1 day' * $1
    LEFT JOIN incidencias i ON i.servicio_id = s.id AND i.eliminado = FALSE
      AND i.estado = 'abierta'
    LEFT JOIN evidencias_servicio ev ON ev.servicio_id = s.id AND ev.eliminado = FALSE
    LEFT JOIN incidencias i2 ON i2.servicio_id = s.id AND i2.eliminado = FALSE
      AND i2.fecha_registro >= CURRENT_DATE - INTERVAL '1 day' * $1
    WHERE ${where}
    GROUP BY s.id, s.nombre, s.estado, c.nombre
    ORDER BY cumplimiento_turnos DESC NULLS LAST`,
    valores
  );

  return rows;
};

module.exports = {
  listarMonitor,
  obtenerDetalleOperativo,
  obtenerIndicadoresOperativos,
  obtenerHistorialIndicadores,
  obtenerIndicadoresPorServicio,
};

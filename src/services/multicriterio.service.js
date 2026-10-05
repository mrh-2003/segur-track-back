'use strict';

const pool = require('../config/db');

const PESO_ALTA = 3;
const PESO_MEDIA = 2;
const PESO_BAJA = 1;
const VENTANA_DIAS = 30;
const UMBRAL_INFLUYE = 60;
const MAX_CRITERIOS_INFLUYEN = 3;

const calcularPuntajeEvidencias = async (servicioId) => {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE estado_revision = 'aprobada') AS aprobadas,
       COUNT(*) FILTER (WHERE estado_revision = 'pendiente') AS pendientes,
       COUNT(*) FILTER (WHERE estado_revision = 'observada') AS observadas
     FROM evidencias_servicio
     WHERE servicio_id = $1 AND eliminado = FALSE`,
    [servicioId]
  );
  const { total, aprobadas, pendientes, observadas } = rows[0];
  const t = parseInt(total, 10);
  if (t === 0) {
    const { rows: prot } = await pool.query(
      'SELECT COUNT(*) AS total FROM servicio_protocolos WHERE servicio_id = $1 AND eliminado = FALSE',
      [servicioId]
    );
    return parseInt(prot[0].total, 10) === 0 ? 80 : 35;
  }
  const a = parseInt(aprobadas, 10);
  const p = parseInt(pendientes, 10);
  const o = parseInt(observadas, 10);
  const puntaje = Math.round(((a * 100) + (p * 60) + (o * 20)) / t);
  return Math.min(100, Math.max(0, puntaje));
};

const calcularPuntajeIncidencias = async (servicioId) => {
  const { rows } = await pool.query(
    `SELECT prioridad, estado
     FROM incidencias
     WHERE servicio_id = $1 AND eliminado = FALSE
       AND fecha_registro >= NOW() - ($2 || ' days')::INTERVAL`,
    [servicioId, VENTANA_DIAS]
  );
  if (rows.length === 0) return 100;
  const penalizacion = rows.reduce((acc, r) => {
    const factorEstado = r.estado === 'cerrada' ? 0.3 : r.estado === 'en_atencion' ? 0.7 : 1.0;
    if (r.prioridad === 'alta') return acc + PESO_ALTA * 15 * factorEstado;
    if (r.prioridad === 'media') return acc + PESO_MEDIA * 10 * factorEstado;
    return acc + PESO_BAJA * 5 * factorEstado;
  }, 0);
  return Math.max(0, Math.min(100, Math.round(100 - penalizacion)));
};

const calcularPuntajeProtocolos = async (servicioId) => {
  const { rows } = await pool.query(
    `SELECT
       sp.protocolo_id,
       COUNT(es.id) FILTER (WHERE es.estado_revision IN ('aprobada', 'pendiente')) AS evidencias
     FROM servicio_protocolos sp
     LEFT JOIN evidencias_servicio es
       ON es.servicio_id = sp.servicio_id
       AND es.protocolo_id = sp.protocolo_id
       AND es.eliminado = FALSE
     WHERE sp.servicio_id = $1 AND sp.eliminado = FALSE
     GROUP BY sp.protocolo_id`,
    [servicioId]
  );
  if (rows.length === 0) return 90;
  const completados = rows.filter((r) => parseInt(r.evidencias, 10) > 0).length;
  return Math.round((completados / rows.length) * 100);
};

const calcularPuntajePuntualidadTurnos = async (servicioId) => {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE estado = 'cumplido') AS cumplidos,
       COUNT(*) FILTER (WHERE estado = 'confirmado') AS confirmados,
       COUNT(*) FILTER (WHERE relevo_pendiente = TRUE) AS relevos_pendientes
     FROM turnos
     WHERE servicio_id = $1 AND eliminado = FALSE
       AND fecha >= CURRENT_DATE - ($2 || ' days')::INTERVAL`,
    [servicioId, VENTANA_DIAS]
  );
  const { total, cumplidos, confirmados, relevos_pendientes } = rows[0];
  const t = parseInt(total, 10);
  if (t === 0) return 100;
  const c = parseInt(cumplidos, 10);
  const conf = parseInt(confirmados, 10);
  const rp = parseInt(relevos_pendientes, 10);
  const puntajeBase = ((c * 100) + (conf * 80)) / t;
  const penalizacionRelevo = (rp / t) * 25;
  return Math.min(100, Math.max(0, Math.round(puntajeBase - penalizacionRelevo)));
};

const obtenerCriterios = async () => {
  const { rows } = await pool.query(
    'SELECT id, codigo, nombre, descripcion, peso, activo FROM criterios_mcda WHERE eliminado = FALSE ORDER BY codigo'
  );
  return rows;
};

const actualizarPesos = async (criterios) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const c of criterios) {
      await client.query(
        'UPDATE criterios_mcda SET peso = $1, actualizado_en = NOW() WHERE id = $2 AND eliminado = FALSE',
        [c.peso, c.id]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const persistirEvaluacion = async (servicioId, puntajeGlobal, nivel, criteriosDetalle) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ev] } = await client.query(
      `INSERT INTO evaluaciones_multicriterio (servicio_id, puntaje_global, nivel)
       VALUES ($1, $2, $3) RETURNING id`,
      [servicioId, puntajeGlobal, nivel]
    );
    for (const c of criteriosDetalle) {
      await client.query(
        `INSERT INTO evaluacion_criterios (evaluacion_id, criterio_id, puntaje, influye)
         VALUES ($1, $2, $3, $4)`,
        [ev.id, c.criterioId, c.puntaje, c.influye]
      );
    }
    await client.query('COMMIT');
    return ev.id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const obtenerResultado = async () => {
  const { rows } = await pool.query(`
    WITH ultimas AS (
      SELECT DISTINCT ON (servicio_id) id, servicio_id, puntaje_global, nivel, fecha_evaluacion
      FROM evaluaciones_multicriterio
      WHERE eliminado = FALSE
      ORDER BY servicio_id, fecha_evaluacion DESC
    )
    SELECT
      COUNT(*) AS evaluados,
      COUNT(*) FILTER (WHERE nivel = 'alta')  AS alta,
      COUNT(*) FILTER (WHERE nivel = 'media') AS media,
      COUNT(*) FILTER (WHERE nivel = 'baja')  AS baja
    FROM ultimas
  `);
  const resumen = rows[0];

  const { rows: tabla } = await pool.query(`
    WITH ultimas AS (
      SELECT DISTINCT ON (servicio_id) id, servicio_id, puntaje_global, nivel, fecha_evaluacion
      FROM evaluaciones_multicriterio
      WHERE eliminado = FALSE
      ORDER BY servicio_id, fecha_evaluacion DESC
    )
    SELECT
      u.id,
      u.servicio_id AS servicio_id,
      s.nombre AS servicio,
      u.puntaje_global AS evaluacion,
      u.nivel,
      u.fecha_evaluacion,
      COALESCE(
        ARRAY_AGG(cm.nombre ORDER BY ec.puntaje ASC)
        FILTER (WHERE ec.influye = TRUE), ARRAY[]::TEXT[]
      ) AS criterios_influyen
    FROM ultimas u
    JOIN servicios s ON u.servicio_id = s.id AND s.eliminado = FALSE
    LEFT JOIN evaluacion_criterios ec ON ec.evaluacion_id = u.id AND ec.eliminado = FALSE
    LEFT JOIN criterios_mcda cm ON ec.criterio_id = cm.id AND cm.eliminado = FALSE
    GROUP BY u.id, u.servicio_id, s.nombre, u.puntaje_global, u.nivel, u.fecha_evaluacion
    ORDER BY u.puntaje_global ASC
  `);

  const indicadores = await obtenerIndicadores();

  return { resumen, tabla, indicadores };
};

const obtenerIndicadores = async () => {
  const { rows: [totalRes] } = await pool.query(
    'SELECT COUNT(*)::INT AS total FROM servicios WHERE eliminado = FALSE'
  );

  const { rows: serviciosPorCliente } = await pool.query(`
    SELECT c.id, c.nombre AS cliente, COUNT(s.id)::INT AS total
    FROM clientes c
    LEFT JOIN servicios s ON s.cliente_id = c.id AND s.eliminado = FALSE
    WHERE c.eliminado = FALSE
    GROUP BY c.id, c.nombre
    ORDER BY total DESC, c.nombre ASC
  `);

  const { rows: [duracionRes] } = await pool.query(`
    SELECT ROUND(AVG(
      CASE
        WHEN hora_fin >= hora_inicio THEN EXTRACT(EPOCH FROM (hora_fin - hora_inicio)) / 3600
        ELSE (EXTRACT(EPOCH FROM (hora_fin - hora_inicio)) + 86400) / 3600
      END
    )::numeric, 1) AS promedio_horas
    FROM servicios
    WHERE eliminado = FALSE AND hora_inicio IS NOT NULL AND hora_fin IS NOT NULL
  `);

  const { rows: serviciosPorHoraInicio } = await pool.query(`
    SELECT TO_CHAR(hora_inicio, 'HH24:00') AS franja, COUNT(*)::INT AS total
    FROM servicios
    WHERE eliminado = FALSE AND hora_inicio IS NOT NULL
    GROUP BY TO_CHAR(hora_inicio, 'HH24:00')
    ORDER BY franja ASC
  `);

  const { rows: topAgentes } = await pool.query(`
    SELECT
      p.id,
      CONCAT(p.nombres, ' ', p.apellidos) AS nombre,
      p.documento,
      COUNT(DISTINCT sp.servicio_id)::INT AS total_servicios
    FROM personal p
    JOIN servicio_personal sp ON sp.personal_id = p.id AND sp.eliminado = FALSE
    JOIN servicios s ON sp.servicio_id = s.id AND s.eliminado = FALSE
    WHERE p.eliminado = FALSE AND p.cargo = 'agente'
    GROUP BY p.id, p.nombres, p.apellidos, p.documento
    ORDER BY total_servicios DESC, nombre ASC
    LIMIT 10
  `);

  const { rows: topClientes } = await pool.query(`
    SELECT
      c.id,
      c.nombre AS cliente,
      COUNT(s.id)::INT AS total_servicios
    FROM clientes c
    JOIN servicios s ON s.cliente_id = c.id AND s.eliminado = FALSE
    WHERE c.eliminado = FALSE
    GROUP BY c.id, c.nombre
    ORDER BY total_servicios DESC, c.nombre ASC
    LIMIT 3
  `);

  return {
    totalServicios: totalRes ? totalRes.total : 0,
    duracionPromedioHoras: duracionRes && duracionRes.promedio_horas ? parseFloat(duracionRes.promedio_horas) : 0,
    serviciosPorCliente,
    serviciosPorHoraInicio,
    topAgentes,
    topClientes,
  };
};

const obtenerDetallePorServicio = async (servicioId) => {
  const { rows } = await pool.query(`
    SELECT
      em.puntaje_global, em.nivel, em.fecha_evaluacion,
      ec.puntaje AS puntaje_criterio, ec.influye,
      cm.nombre AS criterio, cm.codigo, cm.peso
    FROM evaluaciones_multicriterio em
    JOIN evaluacion_criterios ec ON ec.evaluacion_id = em.id AND ec.eliminado = FALSE
    JOIN criterios_mcda cm ON ec.criterio_id = cm.id AND cm.eliminado = FALSE
    WHERE em.servicio_id = $1 AND em.eliminado = FALSE
    ORDER BY em.fecha_evaluacion DESC
    LIMIT 4
  `, [servicioId]);
  return rows;
};

const evaluar = async (servicioId) => {
  const criterios = await obtenerCriterios();
  const activos = criterios.filter((c) => c.activo);

  const puntajes = await Promise.all(activos.map(async (c) => {
    let puntaje = 100;
    if (c.codigo === 'C01') puntaje = await calcularPuntajeEvidencias(servicioId);
    if (c.codigo === 'C02') puntaje = await calcularPuntajeIncidencias(servicioId);
    if (c.codigo === 'C03') puntaje = await calcularPuntajeProtocolos(servicioId);
    if (c.codigo === 'C04') puntaje = await calcularPuntajePuntualidadTurnos(servicioId);
    return { criterioId: c.id, criterio: c.nombre, puntaje, peso: parseFloat(c.peso) };
  }));

  const puntajeGlobal = Math.round(
    puntajes.reduce((acc, p) => acc + p.puntaje * p.peso, 0)
  );

  const nivel = puntajeGlobal < 50 ? 'alta' : puntajeGlobal < 75 ? 'media' : 'baja';

  const ordenados = [...puntajes].sort((a, b) => a.puntaje - b.puntaje);
  const criteriosDetalle = puntajes.map((p) => ({
    ...p,
    influye: p.puntaje < UMBRAL_INFLUYE && ordenados.indexOf(p) < MAX_CRITERIOS_INFLUYEN,
  }));

  await persistirEvaluacion(servicioId, puntajeGlobal, nivel, criteriosDetalle);

  return { servicioId, puntajeGlobal, nivel, criterios: criteriosDetalle };
};

module.exports = {
  obtenerCriterios, actualizarPesos, evaluar,
  obtenerResultado, obtenerIndicadores, obtenerDetallePorServicio,
};

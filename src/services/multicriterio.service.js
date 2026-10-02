'use strict';

const pool = require('../config/db');

const PESO_ALTA   = 3;
const PESO_MEDIA  = 2;
const PESO_BAJA   = 1;
const META_MINUTOS_ATENCION = 30;
const VENTANA_DIAS = 30;
const UMBRAL_INFLUYE = 60;
const MAX_CRITERIOS_INFLUYEN = 3;

const calcularPuntajeTurnos = async (servicioId) => {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE estado = 'cumplido') AS cumplidos
     FROM turnos
     WHERE servicio_id = $1 AND eliminado = FALSE
       AND fecha >= CURRENT_DATE - ($2 || ' days')::INTERVAL`,
    [servicioId, VENTANA_DIAS]
  );
  const { total, cumplidos } = rows[0];
  if (parseInt(total, 10) === 0) return 100;
  return Math.round((parseInt(cumplidos, 10) / parseInt(total, 10)) * 100);
};

const calcularPuntajeServicios = async (servicioId) => {
  const { rows } = await pool.query(
    `SELECT estado FROM servicios WHERE id = $1 AND eliminado = FALSE`,
    [servicioId]
  );
  if (!rows[0]) return 0;
  return rows[0].estado === 'finalizado' ? 100 : rows[0].estado === 'en_curso' ? 75 : 50;
};

const calcularPuntajeIncidencias = async (servicioId) => {
  const { rows } = await pool.query(
    `SELECT prioridad FROM incidencias
     WHERE servicio_id = $1 AND eliminado = FALSE AND estado != 'cerrada'
       AND fecha_registro >= NOW() - ($2 || ' days')::INTERVAL`,
    [servicioId, VENTANA_DIAS]
  );
  const penalizacion = rows.reduce((acc, r) => {
    if (r.prioridad === 'alta')  return acc + PESO_ALTA;
    if (r.prioridad === 'media') return acc + PESO_MEDIA;
    return acc + PESO_BAJA;
  }, 0);
  return Math.max(0, Math.min(100, 100 - penalizacion * 5));
};

const calcularPuntajeTiempoAtencion = async (servicioId) => {
  const { rows } = await pool.query(
    `SELECT AVG(EXTRACT(EPOCH FROM (fecha_atencion - fecha_registro)) / 60) AS promedio
     FROM incidencias
     WHERE servicio_id = $1 AND eliminado = FALSE AND fecha_atencion IS NOT NULL
       AND fecha_registro >= NOW() - ($2 || ' days')::INTERVAL`,
    [servicioId, VENTANA_DIAS]
  );
  const promedio = parseFloat(rows[0].promedio);
  if (!promedio || isNaN(promedio)) return 100;
  return Math.min(100, Math.round((META_MINUTOS_ATENCION / promedio) * 100));
};

const calcularPuntajeResolucion = async (servicioId) => {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE estado = 'cerrada') AS cerradas
     FROM incidencias
     WHERE servicio_id = $1 AND eliminado = FALSE
       AND fecha_registro >= NOW() - ($2 || ' days')::INTERVAL`,
    [servicioId, VENTANA_DIAS]
  );
  const { total, cerradas } = rows[0];
  if (parseInt(total, 10) === 0) return 100;
  return Math.round((parseInt(cerradas, 10) / parseInt(total, 10)) * 100);
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
    SELECT
      COUNT(*) AS evaluados,
      COUNT(*) FILTER (WHERE nivel = 'alta')  AS alta,
      COUNT(*) FILTER (WHERE nivel = 'media') AS media,
      COUNT(*) FILTER (WHERE nivel = 'baja')  AS baja
    FROM evaluaciones_multicriterio
    WHERE eliminado = FALSE
      AND fecha_evaluacion >= NOW() - INTERVAL '24 hours'
  `);
  const resumen = rows[0];

  const { rows: tabla } = await pool.query(`
    SELECT
      em.id,
      s.nombre AS servicio,
      em.puntaje_global AS evaluacion,
      em.nivel,
      em.fecha_evaluacion,
      COALESCE(
        ARRAY_AGG(cm.nombre ORDER BY ec.puntaje ASC)
        FILTER (WHERE ec.influye = TRUE), ARRAY[]::TEXT[]
      ) AS criterios_influyen
    FROM evaluaciones_multicriterio em
    JOIN servicios s ON em.servicio_id = s.id AND s.eliminado = FALSE
    JOIN evaluacion_criterios ec ON ec.evaluacion_id = em.id AND ec.eliminado = FALSE
    JOIN criterios_mcda cm ON ec.criterio_id = cm.id AND cm.eliminado = FALSE
    WHERE em.eliminado = FALSE
      AND em.fecha_evaluacion >= NOW() - INTERVAL '24 hours'
    GROUP BY em.id, s.nombre, em.puntaje_global, em.nivel, em.fecha_evaluacion
    ORDER BY em.puntaje_global ASC
  `);

  return { resumen, tabla };
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
    LIMIT 5
  `, [servicioId]);
  return rows;
};

const evaluar = async (servicioId) => {
  const criterios = await obtenerCriterios();
  const activos = criterios.filter((c) => c.activo);

  const puntajes = await Promise.all(activos.map(async (c) => {
    let puntaje = 100;
    if (c.codigo === 'C01') puntaje = await calcularPuntajeTurnos(servicioId);
    if (c.codigo === 'C02') puntaje = await calcularPuntajeServicios(servicioId);
    if (c.codigo === 'C03') puntaje = await calcularPuntajeIncidencias(servicioId);
    if (c.codigo === 'C04') puntaje = await calcularPuntajeTiempoAtencion(servicioId);
    if (c.codigo === 'C05') puntaje = await calcularPuntajeResolucion(servicioId);
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
  obtenerResultado, obtenerDetallePorServicio,
};

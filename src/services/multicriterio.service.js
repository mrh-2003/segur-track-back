'use strict';
const pool = require('../config/db');
const svc = require('./operacion.service');
const { ErrorValidacion, ErrorNoEncontrado } = require('../utils/errores');
const obtenerCriterios = async () =>
  (
    await pool.query(
      'SELECT codigo AS id,* FROM modelo_operativo ORDER BY codigo'
    )
  ).rows;
const actualizarPesos = async (criterios) => {
  if (
    criterios.length !== 5 ||
    new Set(criterios.map((c) => c.id)).size !== 5 ||
    criterios.some((c) => !/^C0[1-5]$/.test(c.id)) ||
    Math.abs(criterios.reduce((s, c) => s + c.peso, 0) - 1) > 0.000001
  )
    throw new ErrorValidacion(
      'Se requieren los cinco criterios con pesos que sumen 100 %'
    );
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const x of criterios)
      await c.query(
        'UPDATE modelo_operativo SET peso=$1,umbral=COALESCE($2,umbral) WHERE codigo=$3',
        [x.peso, x.umbral || null, x.id]
      );
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
};
const obtenerResultado = (q) => svc.resultado(q);
const obtenerIndicadores = (q) => svc.resultado(q);
const obtenerDetallePorServicio = async (id, q) => {
  const r = await svc.resultado({ ...q, servicios: String(id) });
  if (!r.tabla.length) throw new ErrorNoEncontrado('Servicio no encontrado');
  return {
    ...r.tabla[0],
    filtros: r.filtros,
    version: r.version,
    criticas: r.criticas,
  };
};
const evaluar = (id, q, u) =>
  svc.guardarEvaluacion({ ...q, ...(id ? { servicios: String(id) } : {}) }, u);
module.exports = {
  obtenerCriterios,
  actualizarPesos,
  obtenerResultado,
  obtenerIndicadores,
  obtenerDetallePorServicio,
  evaluar,
};

'use strict';

const pool = require('../config/db');
const incidenciasRepo = require('../repositories/incidencias.repository');
const actividadRepo   = require('../repositories/actividad.repository');
const { ErrorNoEncontrado, ErrorConflicto } = require('../utils/errores');

const listar = async (filtros) => incidenciasRepo.listar(filtros);

const obtenerResumen = async () => incidenciasRepo.obtenerResumen();

const obtenerRecientes = async () => incidenciasRepo.obtenerRecientes(5);

const obtenerPorId = async (id) => {
  const i = await incidenciasRepo.obtenerPorId(id);
  if (!i) throw new ErrorNoEncontrado('Incidencia no encontrada');
  return i;
};

const crear = async (datos, usuarioSolicitante) => {
  let personalId = datos.personalId;
  if (!personalId) {
    const { rows } = await pool.query(
      'SELECT id FROM personal WHERE usuario_id = $1 AND eliminado = FALSE LIMIT 1',
      [usuarioSolicitante]
    );
    if (rows.length > 0) {
      personalId = rows[0].id;
    }
  }

  const codigo = await incidenciasRepo.siguienteCodigo();
  const i = await incidenciasRepo.crear({
    ...datos,
    personalId,
    registradoPor: usuarioSolicitante,
    codigo,
  });

  await actividadRepo.registrar({
    tipo: 'incidencia_registrada',
    descripcion: `Incidencia ${codigo} registrada`,
    usuarioId: usuarioSolicitante,
  });
  return i;
};

const actualizar = async (id, datos, usuarioSolicitante) => {
  let personalId = datos.personalId;
  if (!personalId) {
    const { rows } = await pool.query(
      'SELECT id FROM personal WHERE usuario_id = $1 AND eliminado = FALSE LIMIT 1',
      [usuarioSolicitante]
    );
    if (rows.length > 0) {
      personalId = rows[0].id;
    }
  }

  const i = await incidenciasRepo.actualizar(id, { ...datos, personalId });
  if (!i) throw new ErrorNoEncontrado('Incidencia no encontrada');
  return i;
};

const cambiarEstado = async (id, estado, usuarioSolicitante) => {
  const actual = await incidenciasRepo.obtenerPorId(id);
  if (!actual) throw new ErrorNoEncontrado('Incidencia no encontrada');
  if (estado === 'cerrada' && !actual.fecha_atencion) {
    throw new ErrorConflicto('No se puede cerrar una incidencia sin haber sido atendida previamente');
  }
  const i = await incidenciasRepo.cambiarEstado(id, estado);
  await actividadRepo.registrar({
    tipo: 'incidencia_atendida',
    descripcion: `Incidencia ${actual.codigo} cambiada a estado: ${estado}`,
    usuarioId: usuarioSolicitante,
  });
  return i;
};

const eliminar = async (id, usuarioSolicitante) => {
  const i = await incidenciasRepo.eliminar(id, usuarioSolicitante);
  if (!i) throw new ErrorNoEncontrado('Incidencia no encontrada');
  return i;
};

const listarTipos = async () => incidenciasRepo.listarTipos();

module.exports = {
  listar,
  obtenerResumen,
  obtenerRecientes,
  obtenerPorId,
  crear,
  actualizar,
  cambiarEstado,
  eliminar,
  listarTipos,
};

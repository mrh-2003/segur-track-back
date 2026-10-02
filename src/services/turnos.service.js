'use strict';

const turnosRepo  = require('../repositories/turnos.repository');
const personalRepo = require('../repositories/personal.repository');
const actividadRepo = require('../repositories/actividad.repository');
const { ErrorNoEncontrado, ErrorConflicto } = require('../utils/errores');

const listarPorSemana = async (filtros) => turnosRepo.listarPorSemana(filtros);

const obtenerResumen = async () => turnosRepo.obtenerResumen();

const obtenerAlertas = async () => turnosRepo.obtenerAlertas();

const crear = async (datos, usuarioSolicitante) => {
  const p = await personalRepo.obtenerPorId(datos.personalId);
  if (!p || p.estado !== 'activo') {
    throw new ErrorConflicto('No se puede asignar turno a personal inactivo');
  }
  const solapa = await turnosRepo.verificarSolapamiento(datos);
  if (solapa) {
    throw new ErrorConflicto('El personal ya tiene un turno en ese horario');
  }
  const t = await turnosRepo.crear(datos);
  await actividadRepo.registrar({
    tipo: 'turno_asignado',
    descripcion: `Turno asignado a ${p.nombres} ${p.apellidos} para el ${datos.fecha}`,
    usuarioId: usuarioSolicitante,
  });
  return t;
};

const actualizar = async (id, datos, usuarioSolicitante) => {
  const solapa = await turnosRepo.verificarSolapamiento({ ...datos, excluirId: id });
  if (solapa) throw new ErrorConflicto('El personal ya tiene un turno en ese horario');
  const t = await turnosRepo.actualizar(id, datos);
  if (!t) throw new ErrorNoEncontrado('Turno no encontrado');
  return t;
};

const confirmar = async (id) => {
  const t = await turnosRepo.confirmar(id);
  if (!t) throw new ErrorNoEncontrado('Turno no encontrado');
  return t;
};

const eliminar = async (id, usuarioSolicitante) => {
  const t = await turnosRepo.eliminar(id, usuarioSolicitante);
  if (!t) throw new ErrorNoEncontrado('Turno no encontrado');
  return t;
};

const listarSedes = async () => turnosRepo.listarSedes();

module.exports = { listarPorSemana, obtenerResumen, obtenerAlertas, crear, actualizar, confirmar, eliminar, listarSedes };

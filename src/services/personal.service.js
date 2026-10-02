'use strict';

const personalRepo = require('../repositories/personal.repository');
const actividadRepo = require('../repositories/actividad.repository');
const { ErrorNoEncontrado, ErrorConflicto } = require('../utils/errores');

const listar = async (filtros) => personalRepo.listar(filtros);

const obtenerResumen = async () => personalRepo.obtenerResumen();

const obtenerPorId = async (id) => {
  const p = await personalRepo.obtenerPorId(id);
  if (!p) throw new ErrorNoEncontrado('Personal no encontrado');
  return p;
};

const crear = async (datos, usuarioSolicitante) => {
  const p = await personalRepo.crear(datos);
  await actividadRepo.registrar({
    tipo: 'personal_creado',
    descripcion: `Nuevo ${p.cargo} ${p.nombres} ${p.apellidos} agregado al sistema`,
    usuarioId: usuarioSolicitante,
  });
  return p;
};

const actualizar = async (id, datos, usuarioSolicitante) => {
  const p = await personalRepo.actualizar(id, datos);
  if (!p) throw new ErrorNoEncontrado('Personal no encontrado');
  await actividadRepo.registrar({
    tipo: 'personal_actualizado',
    descripcion: `Datos de ${p.nombres} ${p.apellidos} actualizados`,
    usuarioId: usuarioSolicitante,
  });
  return p;
};

const cambiarEstado = async (id, estado, usuarioSolicitante) => {
  const p = await personalRepo.cambiarEstado(id, estado);
  if (!p) throw new ErrorNoEncontrado('Personal no encontrado');
  await actividadRepo.registrar({
    tipo: 'personal_estado_cambiado',
    descripcion: `Estado de ${p.nombres} ${p.apellidos} cambiado a ${estado}`,
    usuarioId: usuarioSolicitante,
  });
  return p;
};

const eliminar = async (id, usuarioSolicitante) => {
  const p = await personalRepo.eliminar(id, usuarioSolicitante);
  if (!p) throw new ErrorNoEncontrado('Personal no encontrado');
  return p;
};

module.exports = { listar, obtenerResumen, obtenerPorId, crear, actualizar, cambiarEstado, eliminar };

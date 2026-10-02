'use strict';

const sedesRepo = require('../repositories/sedes.repository');
const actividadRepo = require('../repositories/actividad.repository');
const { ErrorNoEncontrado } = require('../utils/errores');

const listar = async (filtros) => sedesRepo.listar(filtros);

const obtenerResumen = async () => sedesRepo.obtenerResumen();

const obtenerPorId = async (id) => {
  const sede = await sedesRepo.obtenerPorId(id);
  if (!sede) throw new ErrorNoEncontrado('Sede no encontrada');
  return sede;
};

const crear = async (datos, usuarioSolicitante) => {
  const sede = await sedesRepo.crear(datos);
  await actividadRepo.registrar({
    tipo: 'sede_creada',
    descripcion: `Nueva sede "${sede.nombre}" registrada`,
    usuarioId: usuarioSolicitante,
  });
  return sede;
};

const actualizar = async (id, datos, usuarioSolicitante) => {
  const sede = await sedesRepo.actualizar(id, datos);
  if (!sede) throw new ErrorNoEncontrado('Sede no encontrada');
  await actividadRepo.registrar({
    tipo: 'sede_actualizada',
    descripcion: `Sede "${sede.nombre}" actualizada`,
    usuarioId: usuarioSolicitante,
  });
  return sede;
};

const eliminar = async (id, usuarioSolicitante) => {
  const sede = await sedesRepo.eliminar(id, usuarioSolicitante);
  if (!sede) throw new ErrorNoEncontrado('Sede no encontrada');
  await actividadRepo.registrar({
    tipo: 'sede_eliminada',
    descripcion: `Sede eliminada del sistema`,
    usuarioId: usuarioSolicitante,
  });
  return sede;
};

module.exports = {
  listar,
  obtenerResumen,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
};

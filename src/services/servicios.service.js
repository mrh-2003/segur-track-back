'use strict';

const serviciosRepo = require('../repositories/servicios.repository');
const actividadRepo = require('../repositories/actividad.repository');
const personalRepo  = require('../repositories/personal.repository');
const { ErrorNoEncontrado, ErrorConflicto } = require('../utils/errores');

const listar = async (filtros) => serviciosRepo.listar(filtros);

const obtenerResumen = async () => serviciosRepo.obtenerResumen();

const obtenerPorId = async (id) => {
  const s = await serviciosRepo.obtenerPorId(id);
  if (!s) throw new ErrorNoEncontrado('Servicio no encontrado');
  return s;
};

const crear = async (datos, usuarioSolicitante) => {
  const supervisor = await personalRepo.obtenerPorId(datos.supervisorId);
  if (!supervisor || supervisor.cargo !== 'supervisor') {
    throw new ErrorConflicto('El supervisor asignado debe tener cargo de supervisor');
  }
  if (supervisor.estado !== 'activo') {
    throw new ErrorConflicto('No se puede asignar personal inactivo como supervisor');
  }
  const s = await serviciosRepo.crear(datos);
  await actividadRepo.registrar({
    tipo: 'servicio_creado',
    descripcion: `Servicio "${s.nombre}" creado`,
    usuarioId: usuarioSolicitante,
  });
  return s;
};

const actualizar = async (id, datos, usuarioSolicitante) => {
  const s = await serviciosRepo.actualizar(id, datos);
  if (!s) throw new ErrorNoEncontrado('Servicio no encontrado');
  await actividadRepo.registrar({
    tipo: 'servicio_actualizado',
    descripcion: `Servicio "${s.nombre}" actualizado`,
    usuarioId: usuarioSolicitante,
  });
  return s;
};

const cambiarEstado = async (id, estado, usuarioSolicitante) => {
  const s = await serviciosRepo.cambiarEstado(id, estado);
  if (!s) throw new ErrorNoEncontrado('Servicio no encontrado');
  if (estado === 'en_curso') {
    await actividadRepo.registrar({
      tipo: 'servicio_iniciado',
      descripcion: `Servicio "${s.nombre}" iniciado`,
      usuarioId: usuarioSolicitante,
    });
  }
  return s;
};

const eliminar = async (id, usuarioSolicitante) => {
  const s = await serviciosRepo.eliminar(id, usuarioSolicitante);
  if (!s) throw new ErrorNoEncontrado('Servicio no encontrado');
  return s;
};

const listarClientes = async () => serviciosRepo.listarClientes();

module.exports = { listar, obtenerResumen, obtenerPorId, crear, actualizar, cambiarEstado, eliminar, listarClientes };

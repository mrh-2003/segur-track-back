'use strict';

const serviciosRepo = require('../repositories/servicios.repository');
const actividadRepo = require('../repositories/actividad.repository');
const personalRepo  = require('../repositories/personal.repository');
const { ErrorNoEncontrado, ErrorConflicto, ErrorAutorizacion } = require('../utils/errores');

const listar = async (filtros) => serviciosRepo.listar(filtros);

const obtenerResumen = async (supervisorId) => serviciosRepo.obtenerResumen(supervisorId);

const obtenerPorId = async (id, usuario) => {
  const s = await serviciosRepo.obtenerPorId(id);
  if (!s) throw new ErrorNoEncontrado('Servicio no encontrado');
  if (usuario && usuario.rol === 'supervisor' && s.supervisor_id !== usuario.personalId) {
    throw new ErrorNoEncontrado('Servicio no encontrado');
  }
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

const actualizar = async (id, datos, usuario) => {
  const actual = await serviciosRepo.obtenerPorId(id);
  if (!actual) throw new ErrorNoEncontrado('Servicio no encontrado');
  if (usuario && usuario.rol === 'supervisor' && actual.supervisor_id !== usuario.personalId) {
    throw new ErrorAutorizacion('Solo puede gestionar servicios donde usted sea el supervisor');
  }
  const s = await serviciosRepo.actualizar(id, datos);
  await actividadRepo.registrar({
    tipo: 'servicio_actualizado',
    descripcion: `Servicio "${s.nombre}" actualizado`,
    usuarioId: usuario.id,
  });
  return s;
};

const cambiarEstado = async (id, estado, usuario) => {
  const actual = await serviciosRepo.obtenerPorId(id);
  if (!actual) throw new ErrorNoEncontrado('Servicio no encontrado');
  if (usuario && usuario.rol === 'supervisor' && actual.supervisor_id !== usuario.personalId) {
    throw new ErrorAutorizacion('Solo puede gestionar servicios donde usted sea el supervisor');
  }
  const s = await serviciosRepo.cambiarEstado(id, estado);
  if (estado === 'en_curso') {
    await actividadRepo.registrar({
      tipo: 'servicio_iniciado',
      descripcion: `Servicio "${s.nombre}" iniciado`,
      usuarioId: usuario.id,
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

'use strict';

const clientesRepo = require('../repositories/clientes.repository');
const actividadRepo = require('../repositories/actividad.repository');
const { ErrorNoEncontrado } = require('../utils/errores');

const listar = async (filtros) => clientesRepo.listar(filtros);

const obtenerResumen = async () => clientesRepo.obtenerResumen();

const obtenerPorId = async (id) => {
  const cliente = await clientesRepo.obtenerPorId(id);
  if (!cliente) throw new ErrorNoEncontrado('Cliente no encontrado');
  return cliente;
};

const crear = async (datos, usuarioSolicitante) => {
  const cliente = await clientesRepo.crear(datos);
  await actividadRepo.registrar({
    tipo: 'cliente_creado',
    descripcion: `Nuevo cliente "${cliente.nombre}" registrado`,
    usuarioId: usuarioSolicitante,
  });
  return cliente;
};

const actualizar = async (id, datos, usuarioSolicitante) => {
  const cliente = await clientesRepo.actualizar(id, datos);
  if (!cliente) throw new ErrorNoEncontrado('Cliente no encontrado');
  await actividadRepo.registrar({
    tipo: 'cliente_actualizado',
    descripcion: `Cliente "${cliente.nombre}" actualizado`,
    usuarioId: usuarioSolicitante,
  });
  return cliente;
};

const eliminar = async (id, usuarioSolicitante) => {
  const cliente = await clientesRepo.eliminar(id, usuarioSolicitante);
  if (!cliente) throw new ErrorNoEncontrado('Cliente no encontrado');
  await actividadRepo.registrar({
    tipo: 'cliente_eliminado',
    descripcion: `Cliente eliminado del sistema`,
    usuarioId: usuarioSolicitante,
  });
  return cliente;
};

module.exports = {
  listar,
  obtenerResumen,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
};

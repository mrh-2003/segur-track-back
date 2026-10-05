'use strict';

const protocolosRepo = require('../repositories/protocolos.repository');
const actividadRepo = require('../repositories/actividad.repository');
const { ErrorNoEncontrado, ErrorConflicto } = require('../utils/errores');

const listar = async (filtros) => {
  return protocolosRepo.listar(filtros);
};

const obtenerPorId = async (id) => {
  const protocolo = await protocolosRepo.obtenerPorId(id);
  if (!protocolo) {
    throw new ErrorNoEncontrado('Protocolo no encontrado');
  }
  return protocolo;
};

const crear = async (datos, usuario) => {
  const existe = await protocolosRepo.buscarPorCodigo(datos.codigo);
  if (existe) {
    throw new ErrorConflicto(`El código de protocolo ${datos.codigo} ya está registrado`);
  }

  const creado = await protocolosRepo.crear(datos);

  await actividadRepo.registrar({
    tipo: 'protocolo_creado',
    descripcion: `Protocolo ${creado.codigo} - ${creado.nombre} registrado`,
    usuarioId: usuario.id,
  });

  return creado;
};

const actualizar = async (id, datos, usuario) => {
  await obtenerPorId(id);

  const conflicto = await protocolosRepo.buscarPorCodigo(datos.codigo, id);
  if (conflicto) {
    throw new ErrorConflicto(`El código de protocolo ${datos.codigo} ya está en uso por otro protocolo`);
  }

  const actualizado = await protocolosRepo.actualizar(id, datos);

  await actividadRepo.registrar({
    tipo: 'protocolo_actualizado',
    descripcion: `Protocolo ${actualizado.codigo} actualizado`,
    usuarioId: usuario.id,
  });

  return actualizado;
};

const eliminar = async (id, usuario) => {
  const protocolo = await obtenerPorId(id);
  await protocolosRepo.eliminar(id, usuario.id);

  await actividadRepo.registrar({
    tipo: 'protocolo_eliminado',
    descripcion: `Protocolo ${protocolo.codigo} eliminado`,
    usuarioId: usuario.id,
  });

  return { id };
};

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
};

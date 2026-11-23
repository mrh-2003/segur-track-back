'use strict';

const sedesRepo = require('../repositories/sedes.repository');
const actividadRepo = require('../repositories/actividad.repository');
const { ErrorNoEncontrado, ErrorValidacion, ErrorConflicto } = require('../utils/errores');

const listar = async (filtros) => sedesRepo.listar(filtros);

const obtenerResumen = async () => sedesRepo.obtenerResumen();

const obtenerPorId = async (id) => {
  const sede = await sedesRepo.obtenerPorId(id);
  if (!sede) throw new ErrorNoEncontrado('Sede no encontrada');
  return sede;
};

const validarResponsables=async(datos)=>{
 const pool=require('../config/db');
 if(!(await pool.query('SELECT 1 FROM clientes WHERE id=$1 AND NOT eliminado',[datos.clienteId])).rowCount)throw new ErrorValidacion('Cliente no válido');
 if(!(await pool.query("SELECT 1 FROM personal WHERE id=$1 AND NOT eliminado AND estado='activo' AND cargo='supervisor'",[datos.supervisorId])).rowCount)throw new ErrorValidacion('Seleccione un supervisor activo');
};
const crear = async (datos, usuarioSolicitante) => {
  await validarResponsables(datos);
  const sede = await sedesRepo.crear(datos);
  await actividadRepo.registrar({
    tipo: 'sede_creada',
    descripcion: `Nueva sede "${sede.nombre}" registrada`,
    usuarioId: usuarioSolicitante,
  });
  return sede;
};

const actualizar = async (id, datos, usuarioSolicitante) => {
  await validarResponsables(datos);
  if((await require('../config/db').query('SELECT 1 FROM servicios WHERE sede_id=$1 AND NOT eliminado AND cliente_id<>$2',[id,datos.clienteId])).rowCount)throw new ErrorConflicto('Esta sede tiene servicios de otro cliente. Revise sus asociaciones antes de cambiar el cliente');
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

'use strict';

const personalRepo = require('../repositories/personal.repository');
const actividadRepo = require('../repositories/actividad.repository');
const { ErrorNoEncontrado, ErrorConflicto, ErrorValidacion } = require('../utils/errores');

const listar = async (filtros) => personalRepo.listar(filtros);

const obtenerResumen = async () => personalRepo.obtenerResumen();

const obtenerPorId = async (id, usuario) => {
  if(usuario) await require('./acceso-servicios').comprobarPersonal(id,usuario);
  const p = await personalRepo.obtenerPorId(id);
  if (!p) throw new ErrorNoEncontrado('Personal no encontrado');
  return p;
};

const validarSedes=async(datos)=>{
 const ids=datos.sedeIds ?? (datos.sedeId?[datos.sedeId]:[]);
 if(new Set(ids).size!==ids.length)throw new ErrorValidacion('No repita sedes');
 const r=await require('../config/db').query('SELECT id FROM sedes WHERE id=ANY($1::int[]) AND NOT eliminado',[ids]);
 if(r.rowCount!==ids.length)throw new ErrorValidacion('Seleccione sedes vigentes');
};
const crear = async (datos, usuarioSolicitante) => {
  await validarSedes(datos);
  const p = await personalRepo.crear(datos);
  await actividadRepo.registrar({
    tipo: 'personal_creado',
    descripcion: `Nuevo ${p.cargo} ${p.nombres} ${p.apellidos} agregado al sistema`,
    usuarioId: usuarioSolicitante,
  });
  return p;
};

const actualizar = async (id, datos, usuarioSolicitante) => {
  await validarSedes(datos);
  if(datos.cargo!=='supervisor' && (await require('../config/db').query('SELECT 1 FROM servicios WHERE supervisor_id=$1 AND NOT eliminado',[id])).rowCount)throw new ErrorConflicto('Reasigne los servicios de este supervisor antes de cambiar su cargo');
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

const reiniciarClave = async (id, usuarioSolicitante) => {
  const p = await personalRepo.reiniciarClave(id);
  if (!p) throw new ErrorNoEncontrado('Personal no encontrado');
  await actividadRepo.registrar({
    tipo: 'personal_clave_reiniciada',
    descripcion: `Contraseña de ${p.nombres} ${p.apellidos} reiniciada por el administrador`,
    usuarioId: usuarioSolicitante,
  });
  return { mensaje: `Contraseña de ${p.nombres} ${p.apellidos} reiniciada a: ${p.correo}` };
};

module.exports = {
  listar,
  obtenerResumen,
  obtenerPorId,
  crear,
  actualizar,
  cambiarEstado,
  eliminar,
  reiniciarClave,
};

'use strict';

const crypto = require('crypto');
const env = require('../config/env');
const turnosRepo   = require('../repositories/turnos.repository');
const personalRepo = require('../repositories/personal.repository');
const actividadRepo = require('../repositories/actividad.repository');
const { ErrorNoEncontrado, ErrorConflicto, ErrorAutorizacion, ErrorValidacion } = require('../utils/errores');

const listarPorSemana = async (filtros) => turnosRepo.listarPorSemana(filtros);

const obtenerResumen = async () => turnosRepo.obtenerResumen();

const obtenerAlertas = async () => turnosRepo.obtenerAlertas();

const crear = async (datos, usuario) => {
  if (usuario.rol === 'operador') {
    throw new ErrorAutorizacion('Los operadores no tienen permiso para asignar turnos');
  }

  const p = await personalRepo.obtenerPorId(datos.personalId);
  if (!p || p.estado !== 'activo') {
    throw new ErrorConflicto('No se puede asignar turno a personal inactivo');
  }

  if (usuario.rol === 'supervisor' && p.cargo !== 'agente') {
    throw new ErrorConflicto('Los supervisores solo pueden asignar turnos a operadores');
  }

  const solapa = await turnosRepo.verificarSolapamiento(datos);
  if (solapa) {
    throw new ErrorConflicto('El personal ya tiene un turno en ese horario');
  }

  const t = await turnosRepo.crear({
    ...datos,
    creadoPor: usuario.id,
  });

  await actividadRepo.registrar({
    tipo: 'turno_asignado',
    descripcion: `Turno asignado a ${p.nombres} ${p.apellidos} para el ${datos.fecha}`,
    usuarioId: usuario.id,
  });

  return t;
};

const actualizar = async (id, datos, usuario) => {
  if (usuario.rol === 'operador') {
    throw new ErrorAutorizacion('Los operadores no pueden modificar turnos');
  }

  const p = await personalRepo.obtenerPorId(datos.personalId);
  if (!p || p.estado !== 'activo') {
    throw new ErrorConflicto('No se puede asignar turno a personal inactivo');
  }

  if (usuario.rol === 'supervisor' && p.cargo !== 'agente') {
    throw new ErrorConflicto('Los supervisores solo pueden asignar turnos a operadores');
  }

  const solapa = await turnosRepo.verificarSolapamiento({ ...datos, excluirId: id });
  if (solapa) throw new ErrorConflicto('El personal ya tiene un turno en ese horario');

  const t = await turnosRepo.actualizar(id, datos);
  if (!t) throw new ErrorNoEncontrado('Turno no encontrado');
  return t;
};

const confirmar = async (id, usuario) => {
  const t = await turnosRepo.obtenerPorId(id);
  if (!t) throw new ErrorNoEncontrado('Turno no encontrado');

  const esAsignado = (t.personal_usuario_id && t.personal_usuario_id === usuario.id) ||
                     (usuario.personalId && t.personal_id === usuario.personalId);
  const esAdmin = usuario.rol === 'administrador' || usuario.rol === 'jefe_operaciones';
  const esSupervisor = usuario.rol === 'supervisor';

  if (!esAsignado && !esAdmin && !esSupervisor) {
    throw new ErrorAutorizacion('No está autorizado para confirmar este turno');
  }

  const actualizado = await turnosRepo.confirmar(id);

  await actividadRepo.registrar({
    tipo: 'turno_confirmado',
    descripcion: `Turno del ${t.fecha} para ${t.personal} confirmado`,
    usuarioId: usuario.id,
  });

  return actualizado;
};

const cumplir = async (id, evidencias, usuario) => {
  const t = await turnosRepo.obtenerPorId(id);
  if (!t) throw new ErrorNoEncontrado('Turno no encontrado');

  const esAsignado = (t.personal_usuario_id && t.personal_usuario_id === usuario.id) ||
                     (usuario.personalId && t.personal_id === usuario.personalId);
  const esAdmin = usuario.rol === 'administrador' || usuario.rol === 'jefe_operaciones';
  const esSupervisor = usuario.rol === 'supervisor';

  if (!esAsignado && !esAdmin && !esSupervisor) {
    throw new ErrorAutorizacion('No está autorizado para culminar este turno');
  }

  if (t.estado === 'sin_confirmar') {
    throw new ErrorConflicto('El turno debe estar confirmado antes de ser culminado');
  }

  const arregloEvidencias = Array.isArray(evidencias) ? evidencias : [];
  if (arregloEvidencias.length === 0) {
    throw new ErrorValidacion('Debe adjuntar al menos una foto de evidencia para culminar el turno');
  }

  const actualizado = await turnosRepo.cumplir(id, arregloEvidencias);

  await actividadRepo.registrar({
    tipo: 'turno_cumplido',
    descripcion: `Turno del ${t.fecha} para ${t.personal} cumplido con ${arregloEvidencias.length} evidencias`,
    usuarioId: usuario.id,
  });

  return actualizado;
};

const obtenerImagekitAuth = () => {
  const token = crypto.randomBytes(16).toString('hex');
  const expire = Math.floor(Date.now() / 1000) + 3000;
  const signature = crypto.createHmac('sha1', env.IMAGEKIT_PRIVATE_KEY).update(token + expire).digest('hex');
  return {
    token,
    expire,
    signature,
    publicKey: env.IMAGEKIT_PUBLIC_KEY,
  };
};

const rechazar = async (id, motivo, usuario) => {
  const t = await turnosRepo.obtenerPorId(id);
  if (!t) throw new ErrorNoEncontrado('Turno no encontrado');

  const esAsignado = (t.personal_usuario_id && t.personal_usuario_id === usuario.id) ||
                     (usuario.personalId && t.personal_id === usuario.personalId);
  const esAdmin = usuario.rol === 'administrador' || usuario.rol === 'jefe_operaciones';
  const esSupervisor = usuario.rol === 'supervisor';

  if (!esAsignado && !esAdmin && !esSupervisor) {
    throw new ErrorAutorizacion('No está autorizado para rechazar este turno');
  }

  const actualizado = await turnosRepo.rechazar(id, motivo);

  await actividadRepo.registrar({
    tipo: 'turno_rechazado',
    descripcion: `Turno del ${t.fecha} de ${t.personal} rechazado. Relevo pendiente.`,
    usuarioId: usuario.id,
  });

  return actualizado;
};

const reasignar = async (id, { personalId }, usuario) => {
  if (usuario.rol === 'operador') {
    throw new ErrorAutorizacion('Los operadores no pueden reasignar turnos');
  }

  const t = await turnosRepo.obtenerPorId(id);
  if (!t) throw new ErrorNoEncontrado('Turno no encontrado');

  const p = await personalRepo.obtenerPorId(personalId);
  if (!p || p.estado !== 'activo') {
    throw new ErrorConflicto('No se puede reasignar turno a personal inactivo');
  }

  if (usuario.rol === 'supervisor' && p.cargo !== 'agente') {
    throw new ErrorConflicto('Los supervisores solo pueden asignar turnos a operadores');
  }

  const solapa = await turnosRepo.verificarSolapamiento({
    personalId,
    fecha: t.fecha,
    horaInicio: t.hora_inicio,
    horaFin: t.hora_fin,
    excluirId: id,
  });
  if (solapa) {
    throw new ErrorConflicto('El nuevo personal ya tiene un turno en ese horario');
  }

  const actualizado = await turnosRepo.reasignar(id, {
    personalId,
    creadorId: usuario.id,
  });

  await actividadRepo.registrar({
    tipo: 'turno_reasignado',
    descripcion: `Turno del ${t.fecha} reasignado a ${p.nombres} ${p.apellidos}`,
    usuarioId: usuario.id,
  });

  return actualizado;
};

const eliminar = async (id, usuarioSolicitante) => {
  const t = await turnosRepo.eliminar(id, usuarioSolicitante);
  if (!t) throw new ErrorNoEncontrado('Turno no encontrado');
  return t;
};

const listarSedes = async () => turnosRepo.listarSedes();

module.exports = {
  listarPorSemana,
  obtenerResumen,
  obtenerAlertas,
  crear,
  actualizar,
  confirmar,
  cumplir,
  obtenerImagekitAuth,
  rechazar,
  reasignar,
  eliminar,
  listarSedes,
};

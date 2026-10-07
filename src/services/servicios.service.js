'use strict';

const serviciosRepo = require('../repositories/servicios.repository');
const actividadRepo = require('../repositories/actividad.repository');
const personalRepo  = require('../repositories/personal.repository');
const incidenciasRepo = require('../repositories/incidencias.repository');
const evidenciasRepo = require('../repositories/evidencias.repository');
const { ErrorNoEncontrado, ErrorConflicto } = require('../utils/errores');

const listar = async (filtros, usuario) => {
  const parametros = { ...filtros };
  if (usuario && usuario.rol === 'operador' && usuario.personalId) {
    parametros.personalId = usuario.personalId;
  }
  return serviciosRepo.listar(parametros);
};

const obtenerResumen = async (supervisorId) => serviciosRepo.obtenerResumen(supervisorId);

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

const actualizar = async (id, datos, usuario) => {
  const actual = await serviciosRepo.obtenerPorId(id);
  if (!actual) throw new ErrorNoEncontrado('Servicio no encontrado');
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

const listarProtocolos = async (servicioId) => {
  await obtenerPorId(servicioId);
  return serviciosRepo.listarProtocolos(servicioId);
};

const asociarProtocolos = async (servicioId, protocoloIds, usuario) => {
  const servicio = await obtenerPorId(servicioId);
  const ids = Array.isArray(protocoloIds) ? protocoloIds : [protocoloIds];
  for (const pId of ids) {
    await serviciosRepo.asociarProtocolo(servicioId, parseInt(pId, 10));
  }
  await actividadRepo.registrar({
    tipo: 'servicio_protocolos_asociados',
    descripcion: `Protocolos asociados al servicio "${servicio.nombre}"`,
    usuarioId: usuario.id,
  });
  return serviciosRepo.listarProtocolos(servicioId);
};

const desasociarProtocolo = async (servicioId, protocoloId, usuario) => {
  const servicio = await obtenerPorId(servicioId);
  await serviciosRepo.desasociarProtocolo(servicioId, protocoloId, usuario.id);
  await actividadRepo.registrar({
    tipo: 'servicio_protocolo_retirado',
    descripcion: `Protocolo retirado del servicio "${servicio.nombre}"`,
    usuarioId: usuario.id,
  });
  return { servicioId, protocoloId };
};

const listarRequerimientos = async (servicioId) => {
  await obtenerPorId(servicioId);
  return serviciosRepo.listarRequerimientos(servicioId);
};

const crearRequerimiento = async (servicioId, datos, usuario) => {
  await obtenerPorId(servicioId);
  const req = await serviciosRepo.crearRequerimiento(servicioId, datos);
  await actividadRepo.registrar({
    tipo: 'requerimiento_creado',
    descripcion: `Requerimiento "${req.titulo}" agregado al servicio #${servicioId}`,
    usuarioId: usuario.id,
  });
  return req;
};

const eliminarRequerimiento = async (id, usuario) => {
  await serviciosRepo.eliminarRequerimiento(id, usuario.id);
  return { id };
};

const obtenerDetalleOperativo = async (servicioId) => {
  const servicio = await obtenerPorId(servicioId);
  const [personalAsignado, protocolos, requerimientos, { filas: evidencias }, { filas: incidencias }] = await Promise.all([
    serviciosRepo.listarPersonalAsignado(servicioId),
    serviciosRepo.listarProtocolos(servicioId),
    serviciosRepo.listarRequerimientos(servicioId),
    evidenciasRepo.listar({ servicioId, limite: 100 }),
    incidenciasRepo.listar({ servicioId, limite: 100 }),
  ]);

  return {
    servicio,
    personalAsignado,
    protocolos,
    requerimientos,
    evidencias,
    incidencias,
  };
};

const asignarPersonal = async (servicioId, personalId, usuario) => {
  const servicio = await obtenerPorId(servicioId);
  const persona = await personalRepo.obtenerPorId(personalId);
  if (!persona || persona.estado !== 'activo') {
    throw new ErrorConflicto('El personal seleccionado no se encuentra disponible');
  }
  const asignados = await serviciosRepo.listarPersonalAsignado(servicioId);
  const yaAsignado = asignados.some((p) => p.id === Number(personalId));
  if (yaAsignado) {
    throw new ErrorConflicto('El personal ya se encuentra asignado al servicio');
  }
  const resultado = await serviciosRepo.asignarPersonal(servicioId, personalId, usuario.id);
  await actividadRepo.registrar({
    tipo: 'personal_asignado',
    descripcion: `${persona.nombres} ${persona.apellidos} asignado al servicio "${servicio.nombre}"`,
    usuarioId: usuario.id,
  });
  return resultado;
};

const desasignarPersonal = async (servicioId, asignacionId, usuario) => {
  const servicio = await obtenerPorId(servicioId);
  const resultado = await serviciosRepo.desasignarPersonal(asignacionId, usuario.id);
  if (!resultado) throw new ErrorNoEncontrado('Asignación no encontrada');
  await actividadRepo.registrar({
    tipo: 'personal_desasignado',
    descripcion: `Personal desasignado del servicio "${servicio.nombre}"`,
    usuarioId: usuario.id,
  });
  return resultado;
};

const listarPersonalAsignado = async (servicioId) => {
  await obtenerPorId(servicioId);
  return serviciosRepo.listarPersonalAsignado(servicioId);
};

const listarTodasAsignaciones = async ({ pagina, limite, servicioId, personalId }) => {
  const { offset, paginaActual, limiteParsed } = require('../utils/paginacion').paginar(pagina, limite);
  const { filas, total } = await serviciosRepo.listarTodasAsignaciones({ servicioId, personalId, limite: limiteParsed, offset });
  return {
    datos: filas,
    meta: { total, pagina: paginaActual, limite: limiteParsed, paginas: Math.ceil(total / limiteParsed) },
  };
};

module.exports = {
  listar,
  obtenerResumen,
  obtenerPorId,
  crear,
  actualizar,
  cambiarEstado,
  eliminar,
  listarClientes,
  listarProtocolos,
  asociarProtocolos,
  desasociarProtocolo,
  listarRequerimientos,
  crearRequerimiento,
  eliminarRequerimiento,
  obtenerDetalleOperativo,
  asignarPersonal,
  desasignarPersonal,
  listarPersonalAsignado,
  listarTodasAsignaciones,
};

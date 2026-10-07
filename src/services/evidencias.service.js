'use strict';

const evidenciasRepo = require('../repositories/evidencias.repository');
const serviciosRepo = require('../repositories/servicios.repository');
const protocolosRepo = require('../repositories/protocolos.repository');
const actividadRepo = require('../repositories/actividad.repository');
const { ErrorNoEncontrado, ErrorValidacion } = require('../utils/errores');

const listar = async (filtros, usuario) => {
  const parametros = { ...filtros };
  if (usuario.rol === 'operador' && usuario.personalId) {
    parametros.personalId = usuario.personalId;
  }
  return evidenciasRepo.listar(parametros);
};

const obtenerPorId = async (id) => {
  const evidencia = await evidenciasRepo.obtenerPorId(id);
  if (!evidencia) {
    throw new ErrorNoEncontrado('Evidencia no encontrada');
  }
  return evidencia;
};

const crear = async (datos, usuario) => {
  const servicio = await serviciosRepo.obtenerPorId(datos.servicioId);
  if (!servicio) {
    throw new ErrorNoEncontrado('El servicio indicado no existe');
  }

  if (datos.protocoloId) {
    const protocolo = await protocolosRepo.obtenerPorId(datos.protocoloId);
    if (!protocolo) {
      throw new ErrorNoEncontrado('El protocolo indicado no existe');
    }
  }

  let personalId = datos.personalId;
  if (!personalId && usuario.personalId) {
    personalId = usuario.personalId;
  }
  if (!personalId && servicio.supervisor_id) {
    personalId = servicio.supervisor_id;
  }
  if (!personalId) {
    const { filas } = await serviciosRepo.listarPersonalAsignado({ servicioId: datos.servicioId, limite: 1 });
    if (filas && filas.length > 0) {
      personalId = filas[0].personal_id;
    }
  }

  if (!personalId) {
    throw new ErrorValidacion('Debe especificarse el personal operativo responsable', [
      { campo: 'personalId', mensaje: 'Personal operativo requerido' },
    ]);
  }

  const creada = await evidenciasRepo.crear({
    servicioId: datos.servicioId,
    protocoloId: datos.protocoloId,
    personalId,
    titulo: datos.titulo,
    descripcion: datos.descripcion,
    archivoUrl: datos.archivoUrl,
  });

  await actividadRepo.registrar({
    tipo: 'evidencia_registrada',
    descripcion: `Evidencia "${creada.titulo}" registrada en servicio ${servicio.nombre}`,
    usuarioId: usuario.id,
  });

  return creada;
};

const revisar = async (id, { estadoRevision, observacion }, usuario) => {
  await obtenerPorId(id);

  const revisada = await evidenciasRepo.revisar(id, {
    estadoRevision,
    observacion,
    revisadoPor: usuario.id,
  });

  await actividadRepo.registrar({
    tipo: 'evidencia_revisada',
    descripcion: `Evidencia #${id} marcada como ${estadoRevision}`,
    usuarioId: usuario.id,
  });

  return revisada;
};

const eliminar = async (id, usuario) => {
  await obtenerPorId(id);
  await evidenciasRepo.eliminar(id, usuario.id);

  await actividadRepo.registrar({
    tipo: 'evidencia_eliminada',
    descripcion: `Evidencia #${id} eliminada`,
    usuarioId: usuario.id,
  });

  return { id };
};

module.exports = {
  listar,
  obtenerPorId,
  crear,
  revisar,
  eliminar,
};

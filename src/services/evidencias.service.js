'use strict';

const evidenciasRepo = require('../repositories/evidencias.repository');
const serviciosRepo = require('../repositories/servicios.repository');
const protocolosRepo = require('../repositories/protocolos.repository');
const actividadRepo = require('../repositories/actividad.repository');
const { ErrorNoEncontrado, ErrorValidacion } = require('../utils/errores');

const listar = async (filtros, usuario) => {
  const parametros = { ...filtros, permitidos:await require('./acceso-servicios').serviciosPermitidos(usuario) };
  if (usuario.rol === 'operador') {
    parametros.personalId = (await require('../config/db').query('SELECT id FROM personal WHERE usuario_id=$1 AND NOT eliminado',[usuario.id])).rows[0]?.id || -1;
  }
  return evidenciasRepo.listar(parametros);
};

const obtenerPorId = async (id,usuario) => {
  const evidencia = await evidenciasRepo.obtenerPorId(id);
  if (!evidencia) {
    throw new ErrorNoEncontrado('Evidencia no encontrada');
  }
  if(usuario){await require('./acceso-servicios').comprobar(evidencia.servicio_id,usuario);if(usuario.rol==='operador')await require('./acceso-servicios').comprobarPersonal(evidencia.personal_id,usuario);}
  return evidencia;
};

const crear = async (datos, usuario) => {
  await require('./acceso-servicios').comprobar(datos.servicioId,usuario);
  if(usuario.rol==='operador'){if(!datos.turnoId)throw new ErrorValidacion('Seleccione su turno');await require('./operacion.service').comprobarAcceso(require('../config/db'),datos.turnoId,usuario);if(datos.personalId)await require('./acceso-servicios').comprobarPersonal(datos.personalId,usuario);}
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
    const { filas } = await serviciosRepo.listarPersonalAsignado({
      servicioId: datos.servicioId,
      limite: 1,
    });
    if (filas && filas.length > 0) {
      personalId = filas[0].personal_id;
    }
  }

  if (!personalId) {
    throw new ErrorValidacion(
      'Debe especificarse el personal operativo responsable',
      [{ campo: 'personalId', mensaje: 'Personal operativo requerido' }]
    );
  }

  if (datos.turnoId) {
    const turno = (
      await require('../config/db').query(
        'SELECT servicio_id,personal_id FROM turnos WHERE id=$1 AND NOT eliminado',
        [datos.turnoId]
      )
    ).rows[0];
    if (
      !turno ||
      turno.servicio_id !== datos.servicioId ||
      turno.personal_id !== personalId
    )
      throw new ErrorValidacion(
        'La evidencia debe corresponder al servicio y al personal del turno'
      );
  }
  const creada = await evidenciasRepo.crear({
    turnoId: datos.turnoId,
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
  await obtenerPorId(id,usuario);

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

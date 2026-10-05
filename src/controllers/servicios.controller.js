'use strict';

const serviciosService = require('../services/servicios.service');
const { respuestaExito, respuestaCreado } = require('../utils/respuesta');
const { paginacion, metaPaginacion } = require('../utils/paginacion');

const listar = async (req, res, next) => {
  try {
    const { limite, offset, pagina } = paginacion(req.query);
    const supervisorId = req.query.supervisorId ? parseInt(req.query.supervisorId, 10) : null;
    const personalId = req.query.personalId
      ? parseInt(req.query.personalId, 10)
      : (req.usuario?.rol === 'operador' && req.query.soloMios === 'true' ? req.usuario.personalId : null);

    const { filas, total } = await serviciosService.listar({
      limite,
      offset,
      q: req.query.q || null,
      clienteId: req.query.clienteId ? parseInt(req.query.clienteId, 10) : null,
      estado: req.query.estado || null,
      supervisorId,
      personalId,
    }, req.usuario);

    respuestaExito(res, filas, metaPaginacion(pagina, limite, total));
  } catch (err) {
    next(err);
  }
};

const resumen = async (req, res, next) => {
  try {
    const supervisorId = req.query.supervisorId ? parseInt(req.query.supervisorId, 10) : null;
    respuestaExito(res, await serviciosService.obtenerResumen(supervisorId));
  } catch (err) {
    next(err);
  }
};

const obtener = async (req, res, next) => {
  try {
    respuestaExito(res, await serviciosService.obtenerPorId(parseInt(req.params.id, 10)));
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    respuestaCreado(res, await serviciosService.crear(req.body, req.usuario.id));
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    respuestaExito(res, await serviciosService.actualizar(parseInt(req.params.id, 10), req.body, req.usuario));
  } catch (err) {
    next(err);
  }
};

const cambiarEstado = async (req, res, next) => {
  try {
    respuestaExito(res, await serviciosService.cambiarEstado(parseInt(req.params.id, 10), req.body.estado, req.usuario));
  } catch (err) {
    next(err);
  }
};

const eliminar = async (req, res, next) => {
  try {
    await serviciosService.eliminar(parseInt(req.params.id, 10), req.usuario.id);
    respuestaExito(res, { mensaje: 'Servicio eliminado' });
  } catch (err) {
    next(err);
  }
};

const listarClientes = async (req, res, next) => {
  try {
    respuestaExito(res, await serviciosService.listarClientes());
  } catch (err) {
    next(err);
  }
};

const listarProtocolos = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const lista = await serviciosService.listarProtocolos(id);
    respuestaExito(res, lista);
  } catch (err) {
    next(err);
  }
};

const asociarProtocolos = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const resultado = await serviciosService.asociarProtocolos(id, req.body.protocolos || req.body.protocoloId, req.usuario);
    respuestaExito(res, resultado);
  } catch (err) {
    next(err);
  }
};

const desasociarProtocolo = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const protocoloId = parseInt(req.params.protocoloId, 10);
    const resultado = await serviciosService.desasociarProtocolo(id, protocoloId, req.usuario);
    respuestaExito(res, resultado);
  } catch (err) {
    next(err);
  }
};

const listarRequerimientos = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const lista = await serviciosService.listarRequerimientos(id);
    respuestaExito(res, lista);
  } catch (err) {
    next(err);
  }
};

const crearRequerimiento = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const resultado = await serviciosService.crearRequerimiento(id, req.body, req.usuario);
    respuestaCreado(res, resultado);
  } catch (err) {
    next(err);
  }
};

const eliminarRequerimiento = async (req, res, next) => {
  try {
    const reqId = parseInt(req.params.reqId, 10);
    const resultado = await serviciosService.eliminarRequerimiento(reqId, req.usuario);
    respuestaExito(res, resultado);
  } catch (err) {
    next(err);
  }
};

const detalleOperativo = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const detalle = await serviciosService.obtenerDetalleOperativo(id);
    respuestaExito(res, detalle);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listar,
  resumen,
  obtener,
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
  detalleOperativo,
};

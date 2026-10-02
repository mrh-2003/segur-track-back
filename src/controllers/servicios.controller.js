'use strict';

const serviciosService = require('../services/servicios.service');
const { respuestaExito, respuestaCreado } = require('../utils/respuesta');
const { paginacion, metaPaginacion } = require('../utils/paginacion');

const listar = async (req, res, next) => {
  try {
    const { limite, offset, pagina } = paginacion(req.query);
    const { filas, total } = await serviciosService.listar({
      limite, offset,
      q:        req.query.q || null,
      clienteId: req.query.clienteId ? parseInt(req.query.clienteId, 10) : null,
      estado:   req.query.estado || null,
    });
    respuestaExito(res, filas, metaPaginacion(pagina, limite, total));
  } catch (err) { next(err); }
};

const resumen = async (req, res, next) => {
  try {
    respuestaExito(res, await serviciosService.obtenerResumen());
  } catch (err) { next(err); }
};

const obtener = async (req, res, next) => {
  try {
    respuestaExito(res, await serviciosService.obtenerPorId(parseInt(req.params.id, 10)));
  } catch (err) { next(err); }
};

const crear = async (req, res, next) => {
  try {
    respuestaCreado(res, await serviciosService.crear(req.body, req.usuario.id));
  } catch (err) { next(err); }
};

const actualizar = async (req, res, next) => {
  try {
    respuestaExito(res, await serviciosService.actualizar(parseInt(req.params.id, 10), req.body, req.usuario.id));
  } catch (err) { next(err); }
};

const cambiarEstado = async (req, res, next) => {
  try {
    respuestaExito(res, await serviciosService.cambiarEstado(parseInt(req.params.id, 10), req.body.estado, req.usuario.id));
  } catch (err) { next(err); }
};

const eliminar = async (req, res, next) => {
  try {
    await serviciosService.eliminar(parseInt(req.params.id, 10), req.usuario.id);
    respuestaExito(res, { mensaje: 'Servicio eliminado' });
  } catch (err) { next(err); }
};

const listarClientes = async (req, res, next) => {
  try {
    respuestaExito(res, await serviciosService.listarClientes());
  } catch (err) { next(err); }
};

module.exports = { listar, resumen, obtener, crear, actualizar, cambiarEstado, eliminar, listarClientes };

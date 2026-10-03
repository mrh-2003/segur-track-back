'use strict';

const personalService = require('../services/personal.service');
const { respuestaExito, respuestaCreado } = require('../utils/respuesta');
const { paginacion, metaPaginacion } = require('../utils/paginacion');

const listar = async (req, res, next) => {
  try {
    const { limite, offset, pagina } = paginacion(req.query);
    const { filas, total } = await personalService.listar({
      limite, offset,
      q:      req.query.q || null,
      estado: req.query.estado || null,
    });
    respuestaExito(res, filas, metaPaginacion(pagina, limite, total));
  } catch (err) { next(err); }
};

const resumen = async (req, res, next) => {
  try {
    respuestaExito(res, await personalService.obtenerResumen());
  } catch (err) { next(err); }
};

const obtener = async (req, res, next) => {
  try {
    respuestaExito(res, await personalService.obtenerPorId(parseInt(req.params.id, 10)));
  } catch (err) { next(err); }
};

const crear = async (req, res, next) => {
  try {
    respuestaCreado(res, await personalService.crear(req.body, req.usuario.id));
  } catch (err) { next(err); }
};

const actualizar = async (req, res, next) => {
  try {
    respuestaExito(res, await personalService.actualizar(parseInt(req.params.id, 10), req.body, req.usuario.id));
  } catch (err) { next(err); }
};

const cambiarEstado = async (req, res, next) => {
  try {
    respuestaExito(res, await personalService.cambiarEstado(parseInt(req.params.id, 10), req.body.estado, req.usuario.id));
  } catch (err) { next(err); }
};

const eliminar = async (req, res, next) => {
  try {
    await personalService.eliminar(parseInt(req.params.id, 10), req.usuario.id);
    respuestaExito(res, { mensaje: 'Personal eliminado' });
  } catch (err) { next(err); }
};

const reiniciarClave = async (req, res, next) => {
  try {
    const r = await personalService.reiniciarClave(parseInt(req.params.id, 10), req.usuario.id);
    respuestaExito(res, r);
  } catch (err) { next(err); }
};

module.exports = {
  listar,
  resumen,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
  eliminar,
  reiniciarClave,
};

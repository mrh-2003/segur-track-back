'use strict';

const incidenciasService = require('../services/incidencias.service');
const { respuestaExito, respuestaCreado } = require('../utils/respuesta');
const { paginacion, metaPaginacion } = require('../utils/paginacion');

const listar = async (req, res, next) => {
  try {
    const { limite, offset, pagina } = paginacion(req.query);
    const { filas, total } = await incidenciasService.listar({
      limite, offset,
      q:      req.query.q || null,
      tipoId: req.query.tipoId ? parseInt(req.query.tipoId, 10) : null,
      estado: req.query.estado || null,
    });
    respuestaExito(res, filas, metaPaginacion(pagina, limite, total));
  } catch (err) { next(err); }
};

const resumen = async (req, res, next) => {
  try {
    respuestaExito(res, await incidenciasService.obtenerResumen());
  } catch (err) { next(err); }
};

const recientes = async (req, res, next) => {
  try {
    respuestaExito(res, await incidenciasService.obtenerRecientes());
  } catch (err) { next(err); }
};

const obtener = async (req, res, next) => {
  try {
    respuestaExito(res, await incidenciasService.obtenerPorId(parseInt(req.params.id, 10)));
  } catch (err) { next(err); }
};

const crear = async (req, res, next) => {
  try {
    respuestaCreado(res, await incidenciasService.crear(req.body, req.usuario.id));
  } catch (err) { next(err); }
};

const actualizar = async (req, res, next) => {
  try {
    respuestaExito(res, await incidenciasService.actualizar(parseInt(req.params.id, 10), req.body, req.usuario.id));
  } catch (err) { next(err); }
};

const cambiarEstado = async (req, res, next) => {
  try {
    respuestaExito(res, await incidenciasService.cambiarEstado(parseInt(req.params.id, 10), req.body.estado, req.usuario.id));
  } catch (err) { next(err); }
};

const eliminar = async (req, res, next) => {
  try {
    await incidenciasService.eliminar(parseInt(req.params.id, 10), req.usuario.id);
    respuestaExito(res, { mensaje: 'Incidencia eliminada' });
  } catch (err) { next(err); }
};

const listarTipos = async (req, res, next) => {
  try {
    respuestaExito(res, await incidenciasService.listarTipos());
  } catch (err) { next(err); }
};

module.exports = { listar, resumen, recientes, obtener, crear, actualizar, cambiarEstado, eliminar, listarTipos };

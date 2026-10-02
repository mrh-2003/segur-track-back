'use strict';

const sedesService = require('../services/sedes.service');
const { respuestaExito, respuestaCreado } = require('../utils/respuesta');

const listar = async (req, res, next) => {
  try {
    const { filas, total } = await sedesService.listar({
      limite: parseInt(req.query.limite, 10) || 50,
      offset: parseInt(req.query.offset, 10) || 0,
      q: req.query.q,
    });
    respuestaExito(res, filas, { total });
  } catch (err) {
    next(err);
  }
};

const resumen = async (req, res, next) => {
  try {
    const datos = await sedesService.obtenerResumen();
    respuestaExito(res, datos);
  } catch (err) {
    next(err);
  }
};

const obtenerPorId = async (req, res, next) => {
  try {
    const sede = await sedesService.obtenerPorId(parseInt(req.params.id, 10));
    respuestaExito(res, sede);
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    const nueva = await sedesService.crear(req.body, req.usuario.id);
    respuestaCreado(res, nueva);
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const actualizada = await sedesService.actualizar(parseInt(req.params.id, 10), req.body, req.usuario.id);
    respuestaExito(res, actualizada);
  } catch (err) {
    next(err);
  }
};

const eliminar = async (req, res, next) => {
  try {
    const eliminada = await sedesService.eliminar(parseInt(req.params.id, 10), req.usuario.id);
    respuestaExito(res, eliminada);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listar,
  resumen,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
};

'use strict';

const evidenciasService = require('../services/evidencias.service');
const { respuestaExito } = require('../utils/respuesta');

const listar = async (req, res, next) => {
  try {
    const lista = await evidenciasService.listar(req.query, req.usuario);
    respuestaExito(res, lista);
  } catch (err) {
    next(err);
  }
};

const obtener = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const item = await evidenciasService.obtenerPorId(id);
    respuestaExito(res, item);
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    const nueva = await evidenciasService.crear(req.body, req.usuario);
    respuestaExito(res, nueva, 201);
  } catch (err) {
    next(err);
  }
};

const revisar = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const resultado = await evidenciasService.revisar(id, req.body, req.usuario);
    respuestaExito(res, resultado);
  } catch (err) {
    next(err);
  }
};

const eliminar = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const resultado = await evidenciasService.eliminar(id, req.usuario);
    respuestaExito(res, resultado);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listar,
  obtener,
  crear,
  revisar,
  eliminar,
};

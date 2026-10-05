'use strict';

const protocolosService = require('../services/protocolos.service');
const { respuestaExito } = require('../utils/respuesta');

const listar = async (req, res, next) => {
  try {
    const lista = await protocolosService.listar(req.query);
    respuestaExito(res, lista);
  } catch (err) {
    next(err);
  }
};

const obtener = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const item = await protocolosService.obtenerPorId(id);
    respuestaExito(res, item);
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    const nuevo = await protocolosService.crear(req.body, req.usuario);
    respuestaExito(res, nuevo, 201);
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const actualizado = await protocolosService.actualizar(id, req.body, req.usuario);
    respuestaExito(res, actualizado);
  } catch (err) {
    next(err);
  }
};

const eliminar = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const resultado = await protocolosService.eliminar(id, req.usuario);
    respuestaExito(res, resultado);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
};

'use strict';

const clientesService = require('../services/clientes.service');
const { respuestaExito, respuestaCreado } = require('../utils/respuesta');

const listar = async (req, res, next) => {
  try {
    const { filas, total } = await clientesService.listar({
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
    const datos = await clientesService.obtenerResumen();
    respuestaExito(res, datos);
  } catch (err) {
    next(err);
  }
};

const obtenerPorId = async (req, res, next) => {
  try {
    const cliente = await clientesService.obtenerPorId(parseInt(req.params.id, 10));
    respuestaExito(res, cliente);
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    const nuevo = await clientesService.crear(req.body, req.usuario.id);
    respuestaCreado(res, nuevo);
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const actualizado = await clientesService.actualizar(parseInt(req.params.id, 10), req.body, req.usuario.id);
    respuestaExito(res, actualizado);
  } catch (err) {
    next(err);
  }
};

const eliminar = async (req, res, next) => {
  try {
    const eliminado = await clientesService.eliminar(parseInt(req.params.id, 10), req.usuario.id);
    respuestaExito(res, eliminado);
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

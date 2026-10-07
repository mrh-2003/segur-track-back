'use strict';

const monitorService = require('../services/monitor.service');
const { respuestaExito } = require('../utils/respuesta');

const listar = async (req, res, next) => {
  try {
    const { estado, sedeId, clienteId } = req.query;
    const datos = await monitorService.listarMonitor({ estado, sedeId, clienteId });
    respuestaExito(res, datos);
  } catch (err) {
    next(err);
  }
};

const detalleOperativo = async (req, res, next) => {
  try {
    const detalle = await monitorService.detalleOperativo(parseInt(req.params.id, 10));
    respuestaExito(res, detalle);
  } catch (err) {
    next(err);
  }
};

const indicadoresOperativos = async (req, res, next) => {
  try {
    const { periodo, servicioId, sedeId, clienteId } = req.query;
    const datos = await monitorService.indicadoresOperativos({ periodo, servicioId, sedeId, clienteId });
    respuestaExito(res, datos);
  } catch (err) {
    next(err);
  }
};

const historialIndicadores = async (req, res, next) => {
  try {
    const { periodos, servicioId, sedeId, clienteId } = req.query;
    const datos = await monitorService.historialIndicadores({ periodos, servicioId, sedeId, clienteId });
    respuestaExito(res, datos);
  } catch (err) {
    next(err);
  }
};

const indicadoresPorServicio = async (req, res, next) => {
  try {
    const { periodo, clienteId, sedeId } = req.query;
    const datos = await monitorService.indicadoresPorServicio({ periodo, clienteId, sedeId });
    respuestaExito(res, datos);
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, detalleOperativo, indicadoresOperativos, historialIndicadores, indicadoresPorServicio };

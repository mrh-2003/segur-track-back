'use strict';

const biRepo = require('../repositories/bi.repository');
const env    = require('../config/env');
const { respuestaExito } = require('../utils/respuesta');

const indicadores = async (req, res, next) => {
  try {
    const datos = await biRepo.obtenerIndicadores({
      periodo:   req.query.periodo   || 30,
      clienteId: req.query.clienteId ? parseInt(req.query.clienteId, 10) : null,
      servicioId: req.query.servicioId ? parseInt(req.query.servicioId, 10) : null,
    });
    respuestaExito(res, datos);
  } catch (err) { next(err); }
};

const evolucionCumplimiento = async (req, res, next) => {
  try {
    respuestaExito(res, await biRepo.obtenerEvolucionCumplimiento());
  } catch (err) { next(err); }
};

const incidenciasPorTipo = async (req, res, next) => {
  try {
    respuestaExito(res, await biRepo.obtenerIncidenciasPorTipo());
  } catch (err) { next(err); }
};

const desempenoPorServicio = async (req, res, next) => {
  try {
    respuestaExito(res, await biRepo.obtenerDesempenoPorServicio());
  } catch (err) { next(err); }
};

const embed = (req, res) => {
  respuestaExito(res, { url: env.POWER_BI_EMBED_URL });
};

module.exports = { indicadores, evolucionCumplimiento, incidenciasPorTipo, desempenoPorServicio, embed };

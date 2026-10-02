'use strict';

const inicioRepo = require('../repositories/inicio.repository');
const { respuestaExito } = require('../utils/respuesta');

const resumen = async (req, res, next) => {
  try {
    respuestaExito(res, await inicioRepo.obtenerResumen());
  } catch (err) { next(err); }
};

const actividadOperativa = async (req, res, next) => {
  try {
    respuestaExito(res, await inicioRepo.obtenerActividadOperativa());
  } catch (err) { next(err); }
};

const actividadReciente = async (req, res, next) => {
  try {
    respuestaExito(res, await inicioRepo.obtenerActividadReciente());
  } catch (err) { next(err); }
};

module.exports = { resumen, actividadOperativa, actividadReciente };

'use strict';

const multicriterioService = require('../services/multicriterio.service');
const { respuestaExito } = require('../utils/respuesta');
const { z } = require('zod');

const esquemaPesos = z.object({
  criterios: z.array(z.object({
    id: z.number().int().positive(),
    peso: z.number().min(0).max(1),
  })).refine(
    (arr) => Math.abs(arr.reduce((s, c) => s + c.peso, 0) - 1) < 0.001,
    { message: 'La suma de pesos debe ser 1' }
  ),
});

const esquemaEvaluar = z.object({
  servicioId: z.number().int().positive(),
});

const criterios = async (req, res, next) => {
  try {
    respuestaExito(res, await multicriterioService.obtenerCriterios());
  } catch (err) { next(err); }
};

const actualizarPesos = async (req, res, next) => {
  try {
    await multicriterioService.actualizarPesos(req.body.criterios);
    respuestaExito(res, { mensaje: 'Pesos actualizados' });
  } catch (err) { next(err); }
};

const evaluar = async (req, res, next) => {
  try {
    respuestaExito(res, await multicriterioService.evaluar(req.body.servicioId));
  } catch (err) { next(err); }
};

const resultado = async (req, res, next) => {
  try {
    respuestaExito(res, await multicriterioService.obtenerResultado());
  } catch (err) { next(err); }
};

const indicadores = async (req, res, next) => {
  try {
    respuestaExito(res, await multicriterioService.obtenerIndicadores());
  } catch (err) { next(err); }
};

const detallePorServicio = async (req, res, next) => {
  try {
    respuestaExito(res, await multicriterioService.obtenerDetallePorServicio(parseInt(req.params.id, 10)));
  } catch (err) { next(err); }
};

module.exports = {
  criterios, actualizarPesos, evaluar, resultado, indicadores, detallePorServicio,
  esquemaPesos, esquemaEvaluar,
};

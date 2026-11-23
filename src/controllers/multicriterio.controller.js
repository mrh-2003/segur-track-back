'use strict';

const multicriterioService = require('../services/multicriterio.service');
const { respuestaExito } = require('../utils/respuesta');
const { z } = require('zod');

const esquemaPesos = z.object({
  criterios: z
    .array(
      z.object({
        id: z.string().regex(/^C0[1-5]$/),
        umbral: z.number().min(1).max(100).optional(),
        peso: z.number().min(0).max(1),
      })
    ).length(5)
    .refine(
      (arr) => Math.abs(arr.reduce((s, c) => s + c.peso, 0) - 1) < 0.001,
      { message: 'La suma de pesos debe ser 1' }
    ),
});

const esquemaEvaluar = z.object({
  servicioId: z.number().int().positive().optional(),
  periodo: z.enum(['3', '7', '30', 'todos']).optional(),
  turno: z.enum(['diurno', 'nocturno', 'ambos']).optional(),
  servicios: z.string().optional(),
});

const criterios = async (req, res, next) => {
  try {
    respuestaExito(res, await multicriterioService.obtenerCriterios());
  } catch (err) {
    next(err);
  }
};

const actualizarPesos = async (req, res, next) => {
  try {
    await multicriterioService.actualizarPesos(req.body.criterios);
    respuestaExito(res, { mensaje: 'Pesos actualizados' });
  } catch (err) {
    next(err);
  }
};

const evaluar = async (req, res, next) => {
  try {
    respuestaExito(
      res,
      await multicriterioService.evaluar(
        req.body.servicioId,
        req.body,
        req.usuario
      )
    );
  } catch (err) {
    next(err);
  }
};

const resultado = async (req, res, next) => {
  try {
    respuestaExito(res, await multicriterioService.obtenerResultado(req.query, req.usuario));
  } catch (err) {
    next(err);
  }
};

const indicadores = async (req, res, next) => {
  try {
    respuestaExito(
      res,
      await multicriterioService.obtenerIndicadores(req.query, req.usuario)
    );
  } catch (err) {
    next(err);
  }
};

const detallePorServicio = async (req, res, next) => {
  try {
    respuestaExito(
      res,
      await multicriterioService.obtenerDetallePorServicio(
        parseInt(req.params.id, 10),
        req.query,
        req.usuario,
        req.params.personalId?Number(req.params.personalId):null
      )
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  criterios,
  actualizarPesos,
  evaluar,
  resultado,
  indicadores,
  detallePorServicio,
  esquemaPesos,
  esquemaEvaluar,
};

'use strict';
const svc = require('../services/importaciones.service');
const { respuestaExito } = require('../utils/respuesta');
exports.plantilla = async (req, res, next) => {
  try {
    res
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .attachment('Plantilla_tareaje.xlsx')
      .send(Buffer.from(await svc.plantilla()));
  } catch (e) {
    next(e);
  }
};
exports.preparar = async (req, res, next) => {
  try {
    const result = await svc.preparar(req.body, req.usuario);
    const { filas, ...meta } = result;
    respuestaExito(res, {
      ...meta,
      totalFilas: filas.length,
      muestra: filas.slice(0, 10),
    });
  } catch (e) {
    next(e);
  }
};
exports.confirmar = async (req, res, next) => {
  try {
    respuestaExito(res, await svc.confirmar(req.params.id, req.usuario));
  } catch (e) {
    next(e);
  }
};

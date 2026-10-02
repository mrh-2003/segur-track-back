'use strict';

const { ErrorApp } = require('../utils/errores');

const manejarErrores = (err, req, res, next) => {
  if (err instanceof ErrorApp) {
    return res.status(err.codigo).json({
      ok:      false,
      mensaje: err.message,
      errores: err.errores || [],
    });
  }

  if (err.code === '23505') {
    return res.status(409).json({
      ok:      false,
      mensaje: 'El registro ya existe o viola una restricción de unicidad',
      errores: [],
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      ok:      false,
      mensaje: 'Referencia inválida: el recurso relacionado no existe',
      errores: [],
    });
  }

  res.status(500).json({
    ok:      false,
    mensaje: 'Error interno del servidor',
    errores: [],
  });
};

const noEncontrado = (req, res) => {
  res.status(404).json({
    ok:      false,
    mensaje: `Ruta ${req.method} ${req.path} no encontrada`,
    errores: [],
  });
};

module.exports = { manejarErrores, noEncontrado };

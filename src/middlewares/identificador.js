'use strict';
const { ErrorValidacion } = require('../utils/errores');
module.exports = (req, res, next, id) => {
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1)
    return next(new ErrorValidacion('Identificador inválido'));
  next();
};

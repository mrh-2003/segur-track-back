'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { ErrorAutenticacion, ErrorAutorizacion } = require('../utils/errores');

const autenticar = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ErrorAutenticacion());
  }
  const token = authHeader.slice(7);
  try {
    req.usuario = jwt.verify(token, env.JWT_SECRET);
    next();
  } catch {
    next(new ErrorAutenticacion('Token inválido o expirado'));
  }
};

const autorizar = (...roles) => (req, res, next) => {
  if (!roles.includes(req.usuario.rol)) {
    return next(new ErrorAutorizacion());
  }
  next();
};

module.exports = { autenticar, autorizar };

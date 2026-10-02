'use strict';

class ErrorApp extends Error {
  constructor(mensaje, codigo = 500, errores = []) {
    super(mensaje);
    this.codigo = codigo;
    this.errores = errores;
  }
}

class ErrorValidacion extends ErrorApp {
  constructor(mensaje, errores = []) {
    super(mensaje, 422, errores);
  }
}

class ErrorNoEncontrado extends ErrorApp {
  constructor(mensaje = 'Recurso no encontrado') {
    super(mensaje, 404);
  }
}

class ErrorConflicto extends ErrorApp {
  constructor(mensaje) {
    super(mensaje, 409);
  }
}

class ErrorAutenticacion extends ErrorApp {
  constructor(mensaje = 'No autorizado') {
    super(mensaje, 401);
  }
}

class ErrorAutorizacion extends ErrorApp {
  constructor(mensaje = 'Acceso denegado') {
    super(mensaje, 403);
  }
}

module.exports = {
  ErrorApp,
  ErrorValidacion,
  ErrorNoEncontrado,
  ErrorConflicto,
  ErrorAutenticacion,
  ErrorAutorizacion,
};

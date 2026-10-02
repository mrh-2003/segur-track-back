'use strict';

const validar = (esquema) => (req, res, next) => {
  const resultado = esquema.safeParse(req.body);
  if (!resultado.success) {
    const errores = resultado.error.errors.map((e) => ({
      campo:   e.path.join('.'),
      mensaje: e.message,
    }));
    return res.status(422).json({
      ok:      false,
      mensaje: 'Datos de entrada inválidos',
      errores,
    });
  }
  req.body = resultado.data;
  next();
};

module.exports = { validar };

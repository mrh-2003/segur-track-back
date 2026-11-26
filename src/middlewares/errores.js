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
    const conflictos = {
      uidx_personal_documento: ['documento', 'Ya existe personal registrado con este DNI.'],
      usuarios_correo_key: ['correo', 'Ya existe una cuenta activa con este correo electrónico.'],
      uidx_usuarios_correo_activo: ['correo', 'Ya existe una cuenta activa con este correo electrónico.'],
      uidx_personal_usuario_activo: ['correo', 'Esta cuenta ya está vinculada a otra persona.'],
    };
    const conflicto = conflictos[err.constraint];
    return res.status(409).json({
      ok:      false,
      mensaje: conflicto?.[1] || 'Ya existe un registro con estos datos.',
      errores: conflicto ? [{ campo: conflicto[0], mensaje: conflicto[1] }] : [],
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

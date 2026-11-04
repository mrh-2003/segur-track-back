'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');
const ctrl = require('../controllers/importaciones.controller');
const r = Router();
r.use(autorizar('administrador', 'jefe_operaciones'));
r.get('/plantilla', ctrl.plantilla);
r.post(
  '/preparar',
  validar(
    z.object({
      nombre: z.string().min(1).max(200),
      base64: z
        .string()
        .min(1)
        .max(12 * 1024 * 1024),
    })
  ),
  ctrl.preparar
);
r.post(
  '/:id/confirmar',
  (req, res, next) => {
    if (!z.string().uuid().safeParse(req.params.id).success)
      return res.status(422).json({ ok: false, mensaje: 'Lote inválido' });
    next();
  },
  ctrl.confirmar
);
module.exports = r;

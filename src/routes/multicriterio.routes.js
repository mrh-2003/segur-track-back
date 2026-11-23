'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/multicriterio.controller');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');

const router = Router();
router.get('/mi-operacion',async(req,res,next)=>{try{require('../utils/respuesta').respuestaExito(res,await require('../services/monitor-operador.service')(req.usuario));}catch(e){next(e);}});
router.param('id', require('../middlewares/identificador'));
router.param('personalId', require('../middlewares/identificador'));
router.get('/servicios/:id/agentes/:personalId',autorizar('administrador','jefe_operaciones','supervisor'),ctrl.detallePorServicio);

router.get(
  '/criterios',
  autorizar('administrador', 'jefe_operaciones', 'supervisor','operador'),
  ctrl.criterios
);
router.get(
  '/resultado',
  autorizar('administrador', 'jefe_operaciones', 'supervisor','operador'),
  ctrl.resultado
);
router.get(
  '/indicadores',
  autorizar('administrador', 'jefe_operaciones', 'supervisor','operador'),
  ctrl.indicadores
);
router.get(
  '/servicios/:id',
  autorizar('administrador', 'jefe_operaciones', 'supervisor','operador'),
  ctrl.detallePorServicio
);

router.post(
  '/evaluar',
  autorizar('administrador', 'jefe_operaciones', 'supervisor'),
  validar(ctrl.esquemaEvaluar),
  ctrl.evaluar
);
router.put(
  '/criterios',
  autorizar('administrador', 'jefe_operaciones'),
  validar(ctrl.esquemaPesos),
  ctrl.actualizarPesos
);

module.exports = router;

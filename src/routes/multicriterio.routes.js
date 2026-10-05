'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/multicriterio.controller');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');

const router = Router();

router.get('/criterios',     autorizar('administrador', 'jefe_operaciones', 'supervisor'), ctrl.criterios);
router.get('/resultado',     autorizar('administrador', 'jefe_operaciones', 'supervisor'), ctrl.resultado);
router.get('/indicadores',   autorizar('administrador', 'jefe_operaciones', 'supervisor'), ctrl.indicadores);
router.get('/servicios/:id', autorizar('administrador', 'jefe_operaciones', 'supervisor'), ctrl.detallePorServicio);

router.post('/evaluar',      autorizar('administrador', 'jefe_operaciones', 'supervisor'), validar(ctrl.esquemaEvaluar), ctrl.evaluar);
router.put('/criterios',     autorizar('administrador', 'jefe_operaciones'), validar(ctrl.esquemaPesos), ctrl.actualizarPesos);

module.exports = router;

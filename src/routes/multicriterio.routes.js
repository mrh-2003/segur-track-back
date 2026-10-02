'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/multicriterio.controller');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');

const router = Router();

router.get('/criterios',         ctrl.criterios);
router.put('/criterios',         autorizar('administrador'), validar(ctrl.esquemaPesos), ctrl.actualizarPesos);
router.post('/evaluar',          autorizar('administrador','supervisor'), validar(ctrl.esquemaEvaluar), ctrl.evaluar);
router.get('/resultado',         ctrl.resultado);
router.get('/servicios/:id',     ctrl.detallePorServicio);

module.exports = router;

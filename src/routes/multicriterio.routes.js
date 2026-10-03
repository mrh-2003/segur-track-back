'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/multicriterio.controller');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');

const router = Router();

router.use(autorizar('administrador'));

router.get('/criterios',         ctrl.criterios);
router.put('/criterios',         validar(ctrl.esquemaPesos), ctrl.actualizarPesos);
router.post('/evaluar',          validar(ctrl.esquemaEvaluar), ctrl.evaluar);
router.get('/resultado',         ctrl.resultado);
router.get('/servicios/:id',     ctrl.detallePorServicio);

module.exports = router;

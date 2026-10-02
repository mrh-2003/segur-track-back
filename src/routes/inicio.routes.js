'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/inicio.controller');

const router = Router();

router.get('/resumen',             ctrl.resumen);
router.get('/actividad-operativa', ctrl.actividadOperativa);
router.get('/actividad-reciente',  ctrl.actividadReciente);

module.exports = router;

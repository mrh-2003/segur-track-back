'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/reportes.controller');
const { validar } = require('../middlewares/validar');

const router = Router();

router.get('/',           ctrl.listar);
router.get('/historial',  ctrl.historial);
router.post('/generar',   validar(ctrl.esquemaGenerar), ctrl.generar);
router.get('/:id/descargar', ctrl.descargar);

module.exports = router;

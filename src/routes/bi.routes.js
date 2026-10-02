'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/bi.controller');

const router = Router();

router.get('/indicadores',           ctrl.indicadores);
router.get('/evolucion-cumplimiento', ctrl.evolucionCumplimiento);
router.get('/incidencias-por-tipo',   ctrl.incidenciasPorTipo);
router.get('/desempeno-servicios',    ctrl.desempenoPorServicio);
router.get('/embed',                  ctrl.embed);

module.exports = router;

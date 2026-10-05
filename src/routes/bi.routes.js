'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/bi.controller');
const { autorizar } = require('../middlewares/auth');

const router = Router();

router.use(autorizar('administrador', 'jefe_operaciones', 'supervisor'));

router.get('/indicadores',           ctrl.indicadores);
router.get('/evolucion-cumplimiento', ctrl.evolucionCumplimiento);
router.get('/incidencias-por-tipo',   ctrl.incidenciasPorTipo);
router.get('/desempeno-servicios',    ctrl.desempenoPorServicio);
router.get('/embed',                  ctrl.embed);

module.exports = router;

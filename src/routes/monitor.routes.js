'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/monitor.controller');

const router = Router();

router.get('/', ctrl.listar);
router.get('/indicadores', ctrl.indicadoresOperativos);
router.get('/historial', ctrl.historialIndicadores);
router.get('/por-servicio', ctrl.indicadoresPorServicio);
router.get('/:id/detalle', ctrl.detalleOperativo);

module.exports = router;

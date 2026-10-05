'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/incidencias.controller');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');
const { esquemaCrear, esquemaActualizar, esquemaCambiarEstado, esquemaObservacion } = require('../validators/incidencias.validator');

const router = Router();

router.get('/', ctrl.listar);
router.get('/resumen', ctrl.resumen);
router.get('/recientes', ctrl.recientes);
router.get('/tipos', ctrl.listarTipos);
router.get('/:id', ctrl.obtener);

router.post('/', validar(esquemaCrear), ctrl.crear);
router.put('/:id', autorizar('administrador', 'jefe_operaciones', 'supervisor'), validar(esquemaActualizar), ctrl.actualizar);
router.patch('/:id/estado', autorizar('administrador', 'jefe_operaciones', 'supervisor'), validar(esquemaCambiarEstado), ctrl.cambiarEstado);
router.patch('/:id/observacion', autorizar('administrador', 'jefe_operaciones', 'supervisor'), validar(esquemaObservacion), ctrl.registrarObservacion);
router.delete('/:id', autorizar('administrador', 'jefe_operaciones'), ctrl.eliminar);

module.exports = router;

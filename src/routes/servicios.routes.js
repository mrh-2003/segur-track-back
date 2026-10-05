'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/servicios.controller');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');
const { esquemaCrear, esquemaActualizar, esquemaCambiarEstado } = require('../validators/servicios.validator');

const router = Router();

router.get('/', ctrl.listar);
router.get('/resumen', ctrl.resumen);
router.get('/:id', ctrl.obtener);
router.get('/:id/detalle-operativo', ctrl.detalleOperativo);

router.post('/', autorizar('administrador', 'jefe_operaciones', 'supervisor'), validar(esquemaCrear), ctrl.crear);
router.put('/:id', autorizar('administrador', 'jefe_operaciones', 'supervisor'), validar(esquemaActualizar), ctrl.actualizar);
router.patch('/:id/estado', autorizar('administrador', 'jefe_operaciones', 'supervisor'), validar(esquemaCambiarEstado), ctrl.cambiarEstado);
router.delete('/:id', autorizar('administrador', 'jefe_operaciones'), ctrl.eliminar);

router.get('/:id/protocolos', ctrl.listarProtocolos);
router.post('/:id/protocolos', autorizar('administrador', 'jefe_operaciones', 'supervisor'), ctrl.asociarProtocolos);
router.delete('/:id/protocolos/:protocoloId', autorizar('administrador', 'jefe_operaciones', 'supervisor'), ctrl.desasociarProtocolo);

router.get('/:id/requerimientos', ctrl.listarRequerimientos);
router.post('/:id/requerimientos', autorizar('administrador', 'jefe_operaciones', 'supervisor'), ctrl.crearRequerimiento);
router.delete('/:id/requerimientos/:reqId', autorizar('administrador', 'jefe_operaciones', 'supervisor'), ctrl.eliminarRequerimiento);

module.exports = router;

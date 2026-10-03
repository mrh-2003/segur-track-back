'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/turnos.controller');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');
const { esquemaCrear, esquemaActualizar, esquemaReasignar } = require('../validators/turnos.validator');

const router = Router();

router.get('/semana',          ctrl.listarSemana);
router.get('/resumen',         ctrl.resumen);
router.get('/alertas',         ctrl.alertas);
router.get('/sedes',           ctrl.listarSedes);
router.post('/',               autorizar('administrador', 'supervisor'), validar(esquemaCrear), ctrl.crear);
router.put('/:id',             autorizar('administrador', 'supervisor'), validar(esquemaActualizar), ctrl.actualizar);
router.patch('/:id/confirmar', ctrl.confirmar);
router.patch('/:id/rechazar',  ctrl.rechazar);
router.patch('/:id/reasignar', autorizar('administrador', 'supervisor'), validar(esquemaReasignar), ctrl.reasignar);
router.delete('/:id',          autorizar('administrador', 'supervisor'), ctrl.eliminar);

module.exports = router;

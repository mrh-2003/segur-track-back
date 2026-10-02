'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/personal.controller');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');
const { esquemaCrear, esquemaActualizar, esquemaCambiarEstado } = require('../validators/personal.validator');

const router = Router();

router.get('/',          ctrl.listar);
router.get('/resumen',   ctrl.resumen);
router.get('/:id',       ctrl.obtener);
router.post('/',         autorizar('administrador', 'supervisor'), validar(esquemaCrear),      ctrl.crear);
router.put('/:id',       autorizar('administrador', 'supervisor'), validar(esquemaActualizar), ctrl.actualizar);
router.patch('/:id/estado', autorizar('administrador', 'supervisor'), validar(esquemaCambiarEstado), ctrl.cambiarEstado);
router.delete('/:id',    autorizar('administrador'),               ctrl.eliminar);

module.exports = router;

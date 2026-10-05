'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/personal.controller');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');
const { esquemaCrear, esquemaActualizar, esquemaCambiarEstado } = require('../validators/personal.validator');

const router = Router();

router.get('/',                        ctrl.listar);
router.get('/resumen',                 autorizar('administrador', 'jefe_operaciones'), ctrl.resumen);
router.get('/:id',                     autorizar('administrador', 'jefe_operaciones', 'supervisor'), ctrl.obtener);
router.post('/',                       autorizar('administrador', 'jefe_operaciones'), validar(esquemaCrear), ctrl.crear);
router.put('/:id',                     autorizar('administrador', 'jefe_operaciones'), validar(esquemaActualizar), ctrl.actualizar);
router.patch('/:id/estado',            autorizar('administrador', 'jefe_operaciones'), validar(esquemaCambiarEstado), ctrl.cambiarEstado);
router.post('/:id/reiniciar-clave',    autorizar('administrador', 'jefe_operaciones'), ctrl.reiniciarClave);
router.delete('/:id',                  autorizar('administrador', 'jefe_operaciones'), ctrl.eliminar);

module.exports = router;

'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/personal.controller');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');
const { esquemaCrear, esquemaActualizar, esquemaCambiarEstado } = require('../validators/personal.validator');

const router = Router();

router.get('/',                        ctrl.listar);
router.get('/resumen',                 autorizar('administrador'), ctrl.resumen);
router.get('/:id',                     autorizar('administrador'), ctrl.obtener);
router.post('/',                       autorizar('administrador'), validar(esquemaCrear), ctrl.crear);
router.put('/:id',                     autorizar('administrador'), validar(esquemaActualizar), ctrl.actualizar);
router.patch('/:id/estado',            autorizar('administrador'), validar(esquemaCambiarEstado), ctrl.cambiarEstado);
router.post('/:id/reiniciar-clave',    autorizar('administrador'), ctrl.reiniciarClave);
router.delete('/:id',                  autorizar('administrador'), ctrl.eliminar);

module.exports = router;

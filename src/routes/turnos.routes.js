'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/turnos.controller');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');
const { esquemaCrear, esquemaActualizar } = require('../validators/turnos.validator');

const router = Router();

router.get('/semana',        ctrl.listarSemana);
router.get('/resumen',       ctrl.resumen);
router.get('/alertas',       ctrl.alertas);
router.get('/sedes',         ctrl.listarSedes);
router.post('/',             autorizar('administrador','supervisor'), validar(esquemaCrear),      ctrl.crear);
router.put('/:id',           autorizar('administrador','supervisor'), validar(esquemaActualizar), ctrl.actualizar);
router.patch('/:id/confirmar', autorizar('administrador','supervisor'), ctrl.confirmar);
router.delete('/:id',        autorizar('administrador'),             ctrl.eliminar);

module.exports = router;

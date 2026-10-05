'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/protocolos.controller');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');
const { esquemaCrear, esquemaActualizar } = require('../validators/protocolos.validator');

const router = Router();

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/', autorizar('administrador', 'jefe_operaciones', 'supervisor'), validar(esquemaCrear), ctrl.crear);
router.put('/:id', autorizar('administrador', 'jefe_operaciones', 'supervisor'), validar(esquemaActualizar), ctrl.actualizar);
router.delete('/:id', autorizar('administrador', 'jefe_operaciones'), ctrl.eliminar);

module.exports = router;

'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/evidencias.controller');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');
const { esquemaCrear, esquemaRevisar } = require('../validators/evidencias.validator');

const router = Router();

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/', validar(esquemaCrear), ctrl.crear);
router.patch('/:id/revisar', autorizar('administrador', 'jefe_operaciones', 'supervisor'), validar(esquemaRevisar), ctrl.revisar);
router.delete('/:id', autorizar('administrador', 'jefe_operaciones'), ctrl.eliminar);

module.exports = router;

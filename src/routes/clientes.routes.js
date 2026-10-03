'use strict';

const { Router } = require('express');
const clientesController = require('../controllers/clientes.controller');
const { autorizar } = require('../middlewares/auth');
const { validar } = require('../middlewares/validar');
const { esquemaCrear, esquemaActualizar } = require('../validators/clientes.validator');

const router = Router();

router.use(autorizar('administrador', 'supervisor'));

router.get('/', clientesController.listar);
router.get('/resumen', clientesController.resumen);
router.get('/:id', clientesController.obtenerPorId);
router.post('/', autorizar('administrador', 'supervisor'), validar(esquemaCrear), clientesController.crear);
router.put('/:id', autorizar('administrador', 'supervisor'), validar(esquemaActualizar), clientesController.actualizar);
router.delete('/:id', autorizar('administrador'), clientesController.eliminar);

module.exports = router;

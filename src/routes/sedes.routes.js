'use strict';

const { Router } = require('express');
const sedesController = require('../controllers/sedes.controller');
const { autorizar } = require('../middlewares/auth');
const { validar } = require('../middlewares/validar');
const { esquemaCrear, esquemaActualizar } = require('../validators/sedes.validator');

const router = Router();


router.get('/', sedesController.listar);
router.get('/resumen', sedesController.resumen);
router.get('/:id', sedesController.obtenerPorId);
router.post('/', autorizar('administrador', 'supervisor'), validar(esquemaCrear), sedesController.crear);
router.put('/:id', autorizar('administrador', 'supervisor'), validar(esquemaActualizar), sedesController.actualizar);
router.delete('/:id', autorizar('administrador'), sedesController.eliminar);

module.exports = router;

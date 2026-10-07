'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/usuarios.controller');
const { autorizar } = require('../middlewares/auth');
const { validar } = require('../middlewares/validar');
const { esquemaCrearUsuario } = require('../validators/usuarios.validator');

const router = Router();

router.get('/', autorizar('administrador'), ctrl.listar);
router.get('/resumen', autorizar('administrador'), ctrl.resumen);
router.get('/:id', autorizar('administrador'), ctrl.obtener);
router.post('/', autorizar('administrador'), validar(esquemaCrearUsuario), ctrl.crear);
router.patch('/:id/rol', autorizar('administrador'), ctrl.cambiarRol);
router.patch('/:id/estado', autorizar('administrador'), ctrl.cambiarEstado);

module.exports = router;

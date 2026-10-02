'use strict';

const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { validar } = require('../middlewares/validar');
const { autenticar } = require('../middlewares/auth');
const {
  esquemaLogin,
  esquemaActualizarPerfil,
  esquemaCambiarClave,
  esquemaSolicitarRecuperacion,
  esquemaRestablecerClave,
} = require('../validators/auth.validator');

const router = Router();

router.post('/login', validar(esquemaLogin), authController.login);
router.post('/solicitar-recuperacion', validar(esquemaSolicitarRecuperacion), authController.solicitarRecuperacion);
router.post('/restablecer-clave', validar(esquemaRestablecerClave), authController.restablecerClave);

router.get('/perfil', autenticar, authController.perfil);
router.put('/perfil', autenticar, validar(esquemaActualizarPerfil), authController.actualizarPerfil);
router.put('/cambiar-clave', autenticar, validar(esquemaCambiarClave), authController.cambiarClave);
router.post('/logout', autenticar, authController.logout);

module.exports = router;

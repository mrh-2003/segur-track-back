'use strict';

const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { validar } = require('../middlewares/validar');
const { autenticar } = require('../middlewares/auth');
const { esquemaLogin } = require('../validators/auth.validator');

const router = Router();

router.post('/login',   validar(esquemaLogin), authController.login);
router.get('/perfil',   autenticar, authController.perfil);
router.post('/logout',  autenticar, authController.logout);

module.exports = router;

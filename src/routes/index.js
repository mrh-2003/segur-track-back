'use strict';

const { Router } = require('express');
const { autenticar } = require('../middlewares/auth');

const authRutas = require('./auth.routes');
const inicioRutas = require('./inicio.routes');
const personalRutas = require('./personal.routes');
const turnosRutas = require('./turnos.routes');
const serviciosRutas = require('./servicios.routes');
const incidenciasRutas = require('./incidencias.routes');
const biRutas = require('./bi.routes');
const multicriterioRutas = require('./multicriterio.routes');
const reportesRutas = require('./reportes.routes');
const sedesRutas = require('./sedes.routes');
const clientesRutas = require('./clientes.routes');

const router = Router();

router.use('/auth', authRutas);
router.use('/inicio', autenticar, inicioRutas);
router.use('/personal', autenticar, personalRutas);
router.use('/turnos', autenticar, turnosRutas);
router.use('/servicios', autenticar, serviciosRutas);
router.use('/incidencias', autenticar, incidenciasRutas);
router.use('/bi', autenticar, biRutas);
router.use('/multicriterio', autenticar, multicriterioRutas);
router.use('/reportes', autenticar, reportesRutas);
router.use('/sedes', sedesRutas);
router.use('/clientes', clientesRutas);

router.get('/tipos-incidencia', autenticar, (req, res, next) => {
  require('../controllers/incidencias.controller').listarTipos(req, res, next);
});

module.exports = router;

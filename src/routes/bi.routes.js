'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/bi.controller');
const { autorizar } = require('../middlewares/auth');

const router = Router();

router.use(autorizar('administrador', 'jefe_operaciones', 'supervisor'));

const {z}=require('zod');
const {validar}=require('../middlewares/validar');
router.get('/resumen',ctrl.resumen);
router.get('/catalogos',ctrl.catalogos);
router.get('/estado',ctrl.estado);
router.post('/sincronizar',autorizar('administrador','jefe_operaciones'),ctrl.sincronizar);
router.get('/configuracion',autorizar('administrador','jefe_operaciones'),ctrl.configuracion);
router.put('/metas',autorizar('administrador','jefe_operaciones'),validar(z.object({vigenteDesde:z.string().date(),metas:z.array(z.object({codigo:z.string().regex(/^I[0-9]{2}$/),valor:z.number().nonnegative().nullable()})).min(1).max(30)})),ctrl.guardarMetas);
router.get('/indicadores',           ctrl.indicadores);
router.get('/evolucion-cumplimiento', ctrl.evolucionCumplimiento);
router.get('/incidencias-por-tipo',   ctrl.incidenciasPorTipo);
router.get('/desempeno-servicios',    ctrl.desempenoPorServicio);
router.get('/embed',                  ctrl.embed);

module.exports = router;

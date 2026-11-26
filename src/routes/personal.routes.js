'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/personal.controller');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');
const { esquemaCrear, esquemaActualizar, esquemaCambiarEstado } = require('../validators/personal.validator');

const router = Router();

router.get('/', autorizar('administrador','jefe_operaciones','supervisor'), ctrl.listar);
router.get('/resumen',                 autorizar('administrador', 'jefe_operaciones'), ctrl.resumen);
router.get('/sedes-asignables', autorizar('administrador','jefe_operaciones','supervisor'), async(req,res,next)=>{try{require('../utils/respuesta').respuestaExito(res,await require('../services/asignacion-sede.service').sedesAsignables(req.usuario));}catch(e){next(e);}});
router.get('/supervisores', autorizar('administrador','jefe_operaciones'), async(req,res,next)=>{try{const r=await require('../config/db').query("SELECT id,nombres,apellidos FROM personal WHERE cargo='supervisor' AND estado='activo' AND NOT eliminado ORDER BY apellidos,nombres");require('../utils/respuesta').respuestaExito(res,r.rows);}catch(e){next(e);}});
router.get('/:id',                     autorizar('administrador', 'jefe_operaciones', 'supervisor'), ctrl.obtener);
router.post('/',                       autorizar('administrador', 'jefe_operaciones'), validar(esquemaCrear), ctrl.crear);
router.put('/:id',                     autorizar('administrador', 'jefe_operaciones'), validar(esquemaActualizar), ctrl.actualizar);
router.patch('/:id/sede', autorizar('administrador','jefe_operaciones','supervisor'), validar(require('zod').z.object({sedeId:require('zod').z.number().int().positive()})), async(req,res,next)=>{try{require('../utils/respuesta').respuestaExito(res,await require('../services/asignacion-sede.service').cambiar(Number(req.params.id),req.body.sedeId,req.usuario));}catch(e){next(e);}});
router.patch('/:id/estado',            autorizar('administrador', 'jefe_operaciones'), validar(esquemaCambiarEstado), ctrl.cambiarEstado);
router.post('/:id/reiniciar-clave',    autorizar('administrador', 'jefe_operaciones'), ctrl.reiniciarClave);
router.delete('/:id',                  autorizar('administrador', 'jefe_operaciones'), ctrl.eliminar);

module.exports = router;

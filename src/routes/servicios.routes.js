'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/servicios.controller');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');
const { esquemaCrear, esquemaActualizar, esquemaCambiarEstado } = require('../validators/servicios.validator');

const router = Router();
const acceso=require('../services/acceso-servicios');
router.use(async(req,res,next)=>{try{
  req.supervisorAsignado=await acceso.supervisorId(req.usuario);
  if(req.usuario.rol==='supervisor' && ['POST','PUT'].includes(req.method) && req.body?.supervisorId!==undefined && req.body.supervisorId!==req.supervisorAsignado)
    throw new (require('../utils/errores').ErrorAutorizacion)('Debe conservarse a usted como supervisor del servicio');
  next();
}catch(e){next(e);}});
router.param('id',require('../middlewares/identificador'));
router.param('id',async(req,res,next,id)=>{try{await acceso.comprobar(Number(id),req.usuario);next();}catch(e){next(e);}});

router.get('/', ctrl.listar);
router.get('/resumen', autorizar('administrador','jefe_operaciones','supervisor'), ctrl.resumen);
router.get('/asignaciones/todas', autorizar('administrador','jefe_operaciones','supervisor'), ctrl.listarTodasAsignaciones);
router.get('/:id', ctrl.obtener);
router.get('/:id/detalle-operativo', ctrl.detalleOperativo);

router.post('/', autorizar('administrador', 'jefe_operaciones'), validar(esquemaCrear), ctrl.crear);
router.put('/:id', autorizar('administrador', 'jefe_operaciones', 'supervisor'), validar(esquemaActualizar), ctrl.actualizar);
router.patch('/:id/estado', autorizar('administrador', 'jefe_operaciones', 'supervisor'), validar(esquemaCambiarEstado), ctrl.cambiarEstado);
router.delete('/:id', autorizar('administrador', 'jefe_operaciones'), ctrl.eliminar);

router.get('/:id/protocolos', ctrl.listarProtocolos);
router.post('/:id/protocolos', autorizar('administrador', 'jefe_operaciones', 'supervisor'), ctrl.asociarProtocolos);
router.delete('/:id/protocolos/:protocoloId', autorizar('administrador', 'jefe_operaciones', 'supervisor'), ctrl.desasociarProtocolo);

router.get('/:id/requerimientos', ctrl.listarRequerimientos);
router.post('/:id/requerimientos', autorizar('administrador', 'jefe_operaciones', 'supervisor'), ctrl.crearRequerimiento);
router.delete('/:id/requerimientos/:reqId', autorizar('administrador', 'jefe_operaciones', 'supervisor'), ctrl.eliminarRequerimiento);

router.get('/:id/personal', autorizar('administrador','jefe_operaciones','supervisor'), ctrl.listarPersonalAsignado);
router.post('/:id/personal', autorizar('administrador', 'jefe_operaciones', 'supervisor'), ctrl.asignarPersonal);
router.delete('/:id/personal/:asignacionId', autorizar('administrador', 'jefe_operaciones', 'supervisor'), ctrl.desasignarPersonal);

module.exports = router;

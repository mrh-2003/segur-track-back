'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { validar } = require('../middlewares/validar');
const { autorizar } = require('../middlewares/auth');
const { respuestaExito } = require('../utils/respuesta');
const svc = require('../services/datos-kpi.service');
const plan = require('../services/plan-operativo.service');
const r = Router();
const gestor=autorizar('administrador','jefe_operaciones','supervisor');
r.param('id', require('../middlewares/identificador'));
r.param('registroId', (req,res,next,id) => /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id)>0 ? next() : next(new (require('../utils/errores').ErrorValidacion)('ID inválido')));
const handler = (fn) => async (req,res,next) => { try { respuestaExito(res, await fn(req)); } catch(e) { next(e); } };
r.get('/servicios/:id/plan', handler((r)=>plan.obtener(Number(r.params.id))));
r.put('/servicios/:id/plan',gestor,validar(z.object({
  plantillas:z.array(z.object({id:z.number().int().positive().optional(),tipo:z.enum(['actividad','ronda','reporte']),descripcion:z.string().trim().min(3).max(1000),minutosDesdeInicio:z.number().int().min(0).max(1440).nullable(),intervaloMin:z.number().int().min(1).max(1440).nullable()})).max(30),
  consignas:z.array(z.object({id:z.number().int().positive().optional(),descripcion:z.string().trim().min(3).max(1000)})).max(50),
})),handler((r)=>plan.guardar(Number(r.params.id),r.body,r.usuario)));
r.get('/turnos/:id', handler((r) => svc.listar(Number(r.params.id),r.usuario)));
r.post('/turnos/:id', validar(z.discriminatedUnion('tipo', [
  z.object({tipo:z.literal('validar_plan')}),
  z.object({tipo:z.literal('aplicar_plan')}),
  z.object({tipo:z.literal('consigna'),consignaId:z.number().int().positive().optional(),descripcion:z.string().trim().min(3).max(1000).optional(),cumplida:z.boolean(),observacion:z.string().max(1000).optional()}),
  ...['actividad','reporte','ronda'].map((tipo) => z.object({tipo:z.literal(tipo),descripcion:z.string().trim().min(3).max(1000),fechaLimite:z.string().datetime({offset:true})})),
])), handler((r) => svc.registrar(Number(r.params.id),r.body,r.usuario)));
r.patch('/turnos/:id/:registroId', validar(z.object({tipo:z.enum(['obligacion','ronda']),accion:z.enum(['completar','anular']),resultado:z.string().trim().max(10000).optional(),evidenciaUrl:z.string().url().startsWith('https://').optional(),evidencias:z.array(z.string().url().startsWith('https://')).max(6).optional(),fechaCompletada:z.string().datetime({offset:true}).optional()})), handler((r) => svc.actualizar(Number(r.params.id),Number(r.params.registroId),r.body,r.usuario)));
module.exports = r;

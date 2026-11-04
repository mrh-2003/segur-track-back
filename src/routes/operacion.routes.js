'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { autorizar } = require('../middlewares/auth');
const { validar } = require('../middlewares/validar');
const ctrl = require('../controllers/operacion.controller');
const r = Router(),
  gestor = autorizar('administrador', 'jefe_operaciones', 'supervisor');
r.param('id', require('../middlewares/identificador'));
const fecha = z.string().datetime({ offset: true });
r.get('/servicios/:id/turnos', ctrl.turnosServicio);
r.get('/responsables', ctrl.responsables);
r.get('/catalogos', gestor, ctrl.catalogos);
r.get('/disponibles', gestor, ctrl.disponibles);
r.get('/opciones-turno', gestor, ctrl.opcionesTurno);
r.get('/turnos/:id/historial', ctrl.historial);
r.patch(
  '/turnos/:id/asistencia',
  validar(
    z.union([
      z.object({ accion: z.enum(['ingreso', 'salida']) }),
      z.object({
        ingresoReal: fecha.nullable(),
        salidaReal: fecha.nullable(),
        validada: z.boolean(),
        motivo: z.string().trim().min(5),
        puesto: z.string().max(200),
        toleranciaMin: z.number().int().min(0).max(120),
        evidenciasRequeridas: z.number().int().min(0).max(1000),
        evidenciasRegistradas: z.number().int().min(0).max(1000),
        evidenciaLimite: fecha.nullable(),
        evidenciaRegistro: fecha.nullable(),
      }),
    ])
  ),
  ctrl.asistencia
);
r.get('/ausencias', gestor, ctrl.ausencias);
r.post(
  '/ausencias',
  gestor,
  validar(
    z
      .object({
        personalId: z.number().int().positive(),
        inicio: fecha,
        fin: fecha,
        motivo: z.string().trim().min(5),
      })
      .refine((d) => new Date(d.fin) > new Date(d.inicio), {
        message: 'Fin debe ser posterior al inicio',
      })
  ),
  ctrl.crearAusencia
);
r.delete('/ausencias/:id', gestor, ctrl.eliminarAusencia);
module.exports = r;

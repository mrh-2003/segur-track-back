'use strict';

const { z } = require('zod');

const esquemaCrear = z.object({
  nombre:       z.string().min(3, 'Nombre requerido'),
  clienteId:    z.number().int().positive(),
  sedeId:       z.number().int().positive(),
  supervisorId: z.number().int().positive(),
  horaInicio:   z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  horaFin:      z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  estado:       z.enum(['programado','en_curso','finalizado']).optional().default('programado'),
  fechaInicio:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  fechaFin:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

const esquemaActualizar = esquemaCrear;

const esquemaCambiarEstado = z.object({
  estado: z.enum(['programado','en_curso','finalizado']),
});

module.exports = { esquemaCrear, esquemaActualizar, esquemaCambiarEstado };

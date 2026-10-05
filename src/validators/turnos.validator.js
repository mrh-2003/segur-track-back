'use strict';

const { z } = require('zod');

const esquemaCrear = z.object({
  personalId:  z.number().int().positive(),
  servicioId:  z.number().int().positive(),
  sedeId:      z.number().int().positive(),
  fecha:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  horaInicio:  z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Formato HH:MM'),
  horaFin:     z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Formato HH:MM'),
  estado:      z.enum(['programado','confirmado','sin_confirmar','cumplido','pendiente']).optional(),
});

const esquemaActualizar = esquemaCrear;

const esquemaReasignar = z.object({
  personalId: z.number().int().positive(),
});

const esquemaCumplir = z.object({
  evidencias: z.array(z.union([z.string().min(1), z.object({ url: z.string().min(1) }).passthrough()])).min(1, 'Debe adjuntar al menos una foto de evidencia'),
});

module.exports = { esquemaCrear, esquemaActualizar, esquemaReasignar, esquemaCumplir };

'use strict';

const { z } = require('zod');

const esquemaCrear = z.object({
  personalId: z.number().int().positive().nullable(),

  servicioId: z.number().int().positive(),

  sedeId: z.number().int().positive(),

  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD')
    .refine((v) => {
      const d = new Date(v + 'T00:00:00Z');
      return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v;
    }, 'Fecha inválida'),

  horaInicio: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Formato HH:MM'),

  horaFin: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Formato HH:MM'),

  puesto: z.string().trim().min(1, 'Puesto o agencia requerido').max(200),

  funcion: z.string().max(80).optional(),

  evidenciasRequeridas: z.number().int().min(0).max(1000).optional(),

  evidenciaLimite: z.string().datetime({ offset: true }).optional(),

  estado: z
    .enum([
      'programado',
      'confirmado',
      'sin_confirmar',
      'cumplido',
      'pendiente',
    ])
    .optional(),
});

const esquemaActualizar = esquemaCrear;

const esquemaReasignar = z.object({
  motivo: z.string().trim().min(5, 'Indique el motivo de la reasignación'),

  personalId: z.number().int().positive(),
});

const esquemaCumplir = z.object({
  evidencias: z
    .array(
      z.union([
        z.string().min(1),
        z.object({ url: z.string().min(1) }).passthrough(),
      ])
    )
    .max(1000, 'Máximo 1000 evidencias'),
});

module.exports = {
  esquemaCrear,
  esquemaActualizar,
  esquemaReasignar,
  esquemaCumplir,
};

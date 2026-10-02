'use strict';

const { z } = require('zod');

const horaValidador = z
  .string()
  .transform((v) => (v ? v.slice(0, 5) : ''))
  .pipe(z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora HH:MM'));

const fechaValidador = z
  .string()
  .transform((v) => (v ? v.slice(0, 10) : ''))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'));

const fechaFinValidador = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (!v || v === '') return null;
    return String(v).slice(0, 10);
  })
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: 'Formato YYYY-MM-DD',
  });

const esquemaCrear = z.object({
  nombre: z.string().min(3, 'Nombre requerido'),
  clienteId: z.number().int().positive('Cliente requerido'),
  sedeId: z.number().int().positive('Sede requerida'),
  supervisorId: z.number().int().positive('Supervisor requerido'),
  horaInicio: horaValidador,
  horaFin: horaValidador,
  estado: z.enum(['programado', 'en_curso', 'finalizado']).optional().default('programado'),
  fechaInicio: fechaValidador,
  fechaFin: fechaFinValidador,
});

const esquemaActualizar = esquemaCrear;

const esquemaCambiarEstado = z.object({
  estado: z.enum(['programado', 'en_curso', 'finalizado']),
});

module.exports = { esquemaCrear, esquemaActualizar, esquemaCambiarEstado };

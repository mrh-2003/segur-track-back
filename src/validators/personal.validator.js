'use strict';

const { z } = require('zod');

const esquemaCrear = z.object({
  nombres: z.string().min(2, 'Nombres requeridos'),
  apellidos: z.string().min(2, 'Apellidos requeridos'),
  documento: z.string().length(8, 'El DNI debe tener 8 dígitos').regex(/^\d+$/, 'Solo dígitos'),
  correo: z.string().email('Correo electrónico válido requerido'),
  cargo: z.enum(['administrador', 'jefe_operaciones', 'supervisor', 'agente'], { message: 'Cargo inválido' }),
  estado: z.enum(['activo', 'inactivo']).optional().default('activo'),
  sedeId: z.number().int().positive().nullable().optional(),
  sedeIds: z.array(z.number().int().positive()).optional(),
  usuarioId: z.number().int().positive().nullable().optional(),
  horarioInicio: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  horarioFin: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  diasLaborales: z.array(z.number().int().min(0).max(6)).min(1).optional(),
}).refine(d => d.cargo !== 'supervisor' || (d.sedeIds ?? (d.sedeId ? [d.sedeId] : [])).length > 0, {message: 'Asigne al menos una sede al supervisor', path: ['sedeIds']})
.refine(d => d.cargo !== 'agente' || (d.sedeIds ?? (d.sedeId ? [d.sedeId] : [])).length === 1, {message: 'El agente debe tener una única sede', path: ['sedeId']})
.refine((d) => Boolean(d.horarioInicio) === Boolean(d.horarioFin), { message: 'Complete ambas horas del horario laboral', path: ['horarioFin'] });

const esquemaActualizar = esquemaCrear;

const esquemaCambiarEstado = z.object({
  estado: z.enum(['activo', 'inactivo'], { message: 'Estado inválido' }),
});

module.exports = { esquemaCrear, esquemaActualizar, esquemaCambiarEstado };

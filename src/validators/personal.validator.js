'use strict';

const { z } = require('zod');

const esquemaCrear = z.object({
  nombres: z.string().min(2, 'Nombres requeridos'),
  apellidos: z.string().min(2, 'Apellidos requeridos'),
  documento: z.string().length(8, 'El DNI debe tener 8 dígitos').regex(/^\d+$/, 'Solo dígitos'),
  correo: z.string().email('Correo electrónico válido requerido'),
  cargo: z.enum(['supervisor', 'agente', 'administrativo'], { message: 'Cargo inválido' }),
  estado: z.enum(['activo', 'inactivo']).optional().default('activo'),
  sedeId: z.number().int().positive('Sede requerida'),
  usuarioId: z.number().int().positive().nullable().optional(),
});

const esquemaActualizar = esquemaCrear;

const esquemaCambiarEstado = z.object({
  estado: z.enum(['activo', 'inactivo'], { message: 'Estado inválido' }),
});

module.exports = { esquemaCrear, esquemaActualizar, esquemaCambiarEstado };

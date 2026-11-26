'use strict';

const { z } = require('zod');

const esquemaCrear = z.object({
  clienteId: z.number().int().positive(),
  supervisorId: z.number().int().positive().nullable().optional(),
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  direccion: z.string().optional().nullable(),
});

const esquemaActualizar = esquemaCrear;

module.exports = { esquemaCrear, esquemaActualizar };

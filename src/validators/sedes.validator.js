'use strict';

const { z } = require('zod');

const esquemaCrear = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  direccion: z.string().optional().nullable(),
});

const esquemaActualizar = esquemaCrear;

module.exports = { esquemaCrear, esquemaActualizar };

'use strict';

const { z } = require('zod');

const esquemaCrear = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  contacto: z.string().optional().nullable(),
});

const esquemaActualizar = esquemaCrear;

module.exports = { esquemaCrear, esquemaActualizar };

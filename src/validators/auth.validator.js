'use strict';

const { z } = require('zod');

const esquemaLogin = z.object({
  correo: z.string().email('Correo inválido'),
  clave:  z.string().min(1, 'La clave es obligatoria'),
});

module.exports = { esquemaLogin };

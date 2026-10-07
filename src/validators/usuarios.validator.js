'use strict';

const { z } = require('zod');

const esquemaCrearUsuario = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  correo: z.string().email('Correo electrónico inválido'),
  clave: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  rol: z.enum(['administrador', 'jefe_operaciones', 'supervisor', 'operador']),
});

module.exports = { esquemaCrearUsuario };

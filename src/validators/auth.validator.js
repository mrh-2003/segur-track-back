'use strict';

const { z } = require('zod');

const esquemaLogin = z.object({
  correo: z.string().email('Correo electrónico inválido'),
  clave: z.string().min(1, 'La contraseña es obligatoria'),
});

const esquemaActualizarPerfil = z.object({
  nombres: z.string().min(2, 'Los nombres deben tener al menos 2 caracteres'),
  apellidos: z.string().min(2, 'Los apellidos deben tener al menos 2 caracteres'),
});

const esquemaCambiarClave = z.object({
  claveActual: z.string().min(1, 'La contraseña actual es requerida'),
  nuevaClave: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una letra mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una letra minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial (!@#$%^&*...)'),
});

const esquemaSolicitarRecuperacion = z.object({
  correo: z.string().email('Correo electrónico inválido'),
});

const esquemaRestablecerClave = z.object({
  correo: z.string().email('Correo electrónico inválido'),
  codigo: z.string().min(4, 'Código de recuperación inválido'),
  nuevaClave: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una letra mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una letra minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial (!@#$%^&*...)'),
});

module.exports = {
  esquemaLogin,
  esquemaActualizarPerfil,
  esquemaCambiarClave,
  esquemaSolicitarRecuperacion,
  esquemaRestablecerClave,
};

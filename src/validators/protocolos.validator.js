'use strict';

const { z } = require('zod');

const esquemaCrear = z.object({
  codigo: z.string().trim().min(2, 'El código debe tener al menos 2 caracteres').max(20, 'Máximo 20 caracteres'),
  nombre: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(120, 'Máximo 120 caracteres'),
  descripcion: z.string().trim().optional().nullable(),
  actividades: z.string().trim().min(5, 'Las actividades y lineamientos son obligatorios'),
  activo: z.boolean().optional().default(true),
});

const esquemaActualizar = z.object({
  codigo: z.string().trim().min(2, 'El código debe tener al menos 2 caracteres').max(20, 'Máximo 20 caracteres'),
  nombre: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(120, 'Máximo 120 caracteres'),
  descripcion: z.string().trim().optional().nullable(),
  actividades: z.string().trim().min(5, 'Las actividades y lineamientos son obligatorios'),
  activo: z.boolean().optional().default(true),
});

module.exports = {
  esquemaCrear,
  esquemaActualizar,
};

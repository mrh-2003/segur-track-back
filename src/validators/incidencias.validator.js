'use strict';

const { z } = require('zod');

const esquemaCrear = z.object({
  tipoIncidenciaId: z.number().int().positive('Tipo de incidencia requerido'),
  servicioId:       z.number().int().positive('Servicio requerido'),
  personalId:       z.number().int().positive().nullable().optional(),
  descripcion:      z.string().min(10, 'Descripción mínima 10 caracteres'),
  prioridad:        z.enum(['alta', 'media', 'baja'], { message: 'Prioridad inválida' }),
});

const esquemaActualizar = z.object({
  tipoIncidenciaId: z.number().int().positive('Tipo de incidencia requerido'),
  servicioId:       z.number().int().positive('Servicio requerido'),
  personalId:       z.number().int().positive().nullable().optional(),
  descripcion:      z.string().min(10, 'Descripción mínima 10 caracteres'),
  prioridad:        z.enum(['alta', 'media', 'baja'], { message: 'Prioridad inválida' }),
  estado:           z.enum(['abierta', 'en_atencion', 'cerrada']),
});

const esquemaCambiarEstado = z.object({
  estado: z.enum(['abierta', 'en_atencion', 'cerrada']),
});

module.exports = { esquemaCrear, esquemaActualizar, esquemaCambiarEstado };

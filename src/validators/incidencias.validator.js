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
  observacion:      z.string().trim().optional().nullable(),
});

const esquemaCambiarEstado = z.object({
  estado:      z.enum(['abierta', 'en_atencion', 'cerrada']),
  observacion: z.string().trim().optional().nullable(),
});

const esquemaObservacion = z.object({
  observacion: z.string().trim().min(3, 'La observación debe tener al menos 3 caracteres'),
});

module.exports = {
  esquemaCrear,
  esquemaActualizar,
  esquemaCambiarEstado,
  esquemaObservacion,
};

'use strict';

const { z } = require('zod');

const esquemaCrear = z.object({
  tipoIncidenciaId: z.number().int().positive(),
  servicioId:       z.number().int().positive(),
  descripcion:      z.string().min(10, 'Descripción mínima 10 caracteres'),
  prioridad:        z.enum(['alta','media','baja']),
});

const esquemaActualizar = z.object({
  tipoIncidenciaId: z.number().int().positive(),
  servicioId:       z.number().int().positive(),
  descripcion:      z.string().min(10),
  prioridad:        z.enum(['alta','media','baja']),
  estado:           z.enum(['abierta','en_atencion','cerrada']),
});

const esquemaCambiarEstado = z.object({
  estado: z.enum(['abierta','en_atencion','cerrada']),
});

module.exports = { esquemaCrear, esquemaActualizar, esquemaCambiarEstado };

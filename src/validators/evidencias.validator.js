'use strict';

const { z } = require('zod');

const esquemaCrear = z.object({
  servicioId: z.coerce.number().int().positive('Servicio requerido'),
  protocoloId: z.coerce.number().int().positive().optional().nullable(),
  personalId: z.coerce.number().int().positive().optional().nullable(),
  titulo: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres').max(150, 'Máximo 150 caracteres'),
  descripcion: z.string().trim().optional().nullable(),
  archivoUrl: z.string().trim().optional().nullable(),
});

const esquemaRevisar = z.object({
  estadoRevision: z.enum(['pendiente', 'aprobada', 'observada'], {
    errorMap: () => ({ mensaje: 'Estado de revisión inválido' }),
  }),
  observacion: z.string().trim().optional().nullable(),
});

module.exports = {
  esquemaCrear,
  esquemaRevisar,
};

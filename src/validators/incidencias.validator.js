'use strict';
const {z}=require('zod');
const evidencias=z.array(z.string().url().refine(v=>v.startsWith('https://'),'La imagen debe estar almacenada en HTTPS')).max(20).default([]);
const esquemaCrear=z.object({
 tipoIncidenciaId:z.number().int().positive(),servicioId:z.number().int().positive(),responsableId:z.number().int().positive().optional(),
 slaResolucionMin:z.number().int().min(1).max(525600).optional(),slaMin:z.number().int().min(1).max(525600).optional(),
 turnoId:z.number().int().positive().nullable().optional(),personalId:z.number().int().positive().nullable().optional(),
 descripcion:z.string().trim().min(10).max(10000),prioridad:z.enum(['critica','alta','media','baja']),evidencias
});
const esquemaActualizar=esquemaCrear.extend({estado:z.enum(['abierta','en_atencion','cerrada']).optional(),observacion:z.string().trim().optional().nullable()});
const esquemaAccion=z.object({accion:z.enum(['atender','avance','resolver']),comentario:z.string().trim().min(3).max(10000).optional(),evidencias});
const esquemaCambiarEstado=z.object({estado:z.enum(['abierta','en_atencion','cerrada']),observacion:z.string().trim().min(3).max(10000).optional(),evidencias});
const esquemaObservacion=z.object({observacion:z.string().trim().min(3).max(10000),evidencias});
const esquemaSolicitud=z.object({motivo:z.string().trim().min(10).max(3000),plazoSolicitado:z.string().datetime({offset:true}),evidencias});
const esquemaDecision=z.object({decision:z.enum(['aprobada','rechazada']),comentario:z.string().trim().min(3).max(3000)});
module.exports={esquemaCrear,esquemaActualizar,esquemaAccion,esquemaCambiarEstado,esquemaObservacion,esquemaSolicitud,esquemaDecision};

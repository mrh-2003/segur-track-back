'use strict';
module.exports=async(c)=>{
 const agentes=(await c.query(`SELECT DISTINCT s.id servicio_id,p.id personal_id,p.usuario_id,ps.usuario_id supervisor
  FROM servicios s JOIN servicio_personal sp ON sp.servicio_id=s.id AND NOT sp.eliminado JOIN personal p ON p.id=sp.personal_id
  JOIN personal ps ON ps.id=s.supervisor_id WHERE s.codigo_externo LIKE 'DEMO-SRV-%' AND NOT s.eliminado AND p.cargo='agente' AND p.estado='activo' AND NOT p.eliminado AND p.usuario_id IS NOT NULL
  ORDER BY s.id,p.id`)).rows;
 const ahora=+(await c.query('SELECT clock_timestamp() ahora')).rows[0].ahora;
 const tipo=(await c.query('SELECT MIN(id) id FROM tipos_incidencia WHERE NOT eliminado')).rows[0].id;
 const nombres=['Por atender dentro del plazo','Por atender con plazo vencido','Corrección en proceso','Corrección vencida','Resuelta dentro del plazo','Resuelta fuera del plazo','Ampliación pendiente','Ampliación aprobada','Ampliación rechazada'];
 const horas=[.5,3,2,4,8,24,4,4,4],sla=[240,60,240,60,240,120,60,60,60],datos=[],servicios=new Set();
 for(const a of agentes){for(let n=0;n<(servicios.has(a.servicio_id)?6:9);n++){
  const fecha=new Date(ahora-horas[n]*3600000).toISOString(),atencion=n>=2?new Date(+new Date(fecha)+10*60000).toISOString():null;
  datos.push({...a,n,codigo:'OP'+a.servicio_id.toString(36)+'-'+a.personal_id.toString(36)+'-'+n,tipo_id:tipo,descripcion:'DEMO OPERATIVA · '+nombres[n],fecha,atencion,cierre:n===4?new Date(ahora-6*3600000).toISOString():n===5?new Date(ahora-16*3600000).toISOString():null,sla:sla[n],extendido:n===7?new Date(ahora+4*3600000).toISOString():null});
 }servicios.add(a.servicio_id);}
 const nuevas=(await c.query(`INSERT INTO incidencias(codigo,tipo_incidencia_id,servicio_id,personal_id,descripcion,prioridad,estado,fecha_registro,fecha_atencion,fecha_cierre,registrado_por,responsable_id,sla_min,sla_resolucion_min,origen_plazo,plazo_resolucion_extendido,evidencias,observacion)
  SELECT codigo,tipo_id,servicio_id,personal_id,descripcion,'media',CASE WHEN cierre IS NOT NULL THEN 'cerrada' WHEN atencion IS NOT NULL THEN 'en_atencion' ELSE 'abierta' END,
   fecha,atencion,cierre,usuario_id,personal_id,60,sla,'demo_operativa_v2',extendido,CASE WHEN cierre IS NOT NULL THEN '["/evidencias-demo/correccion.svg"]'::jsonb ELSE '[]'::jsonb END,
   CASE WHEN cierre IS NOT NULL THEN 'DEMO: corrección completada y documentada con una evidencia sintética.' END
  FROM jsonb_to_recordset($1) d(codigo text,tipo_id int,servicio_id int,personal_id int,descripcion text,fecha timestamptz,atencion timestamptz,cierre timestamptz,usuario_id int,sla int,extendido timestamptz)
  ON CONFLICT(codigo) WHERE NOT eliminado DO NOTHING RETURNING *`,[JSON.stringify(datos)])).rows;
 const eventos=[],ampliaciones=[];
 for(const i of nuevas){const a=datos.find(d=>d.codigo===i.codigo);
  for(const [accion,momento] of [['registrar',i.fecha_registro],['atender',i.fecha_atencion],['resolver',i.fecha_cierre]])if(momento)eventos.push({incidencia_id:i.id,accion,comentario:'DEMO: '+({registrar:'incidencia reportada',atender:'primera atención registrada',resolver:'corrección completada'}[accion]),evidencias:accion==='resolver'?['/evidencias-demo/correccion.svg']:[],usuario_id:a.usuario_id,creado_en:momento});
  if(a.n>=6&&a.supervisor){const estado=['pendiente','aprobada','rechazada'][a.n-6];
   ampliaciones.push({incidencia_id:i.id,solicitado_por:a.usuario_id,motivo:'DEMO: se requiere apoyo técnico para completar la corrección',plazo_anterior:new Date(+new Date(i.fecha_registro)+i.sla_resolucion_min*60000),plazo_solicitado:new Date(ahora+4*3600000),estado,decidido_por:estado==='pendiente'?null:a.supervisor,decidido_en:estado==='pendiente'?null:new Date(ahora),respuesta:estado==='pendiente'?null:'DEMO: decisión registrada por supervisión',solicitado_en:new Date(ahora-30*60000)});
   eventos.push({incidencia_id:i.id,accion:'solicitar_ampliacion',comentario:'DEMO: solicitud de apoyo técnico',evidencias:[],usuario_id:a.usuario_id,creado_en:new Date(ahora-30*60000)});
   if(estado!=='pendiente')eventos.push({incidencia_id:i.id,accion:estado==='aprobada'?'aprobar_ampliacion':'rechazar_ampliacion',comentario:'DEMO: decisión del supervisor',evidencias:[],usuario_id:a.supervisor,creado_en:new Date(ahora)});
  }
 }
 await c.query(`INSERT INTO incidencias_seguimiento(incidencia_id,accion,comentario,evidencias,usuario_id,creado_en) SELECT * FROM jsonb_to_recordset($1) d(incidencia_id int,accion text,comentario text,evidencias jsonb,usuario_id int,creado_en timestamptz)`,[JSON.stringify(eventos)]);
 await c.query(`INSERT INTO incidencias_ampliaciones(incidencia_id,solicitado_por,motivo,plazo_anterior,plazo_solicitado,estado,decidido_por,decidido_en,respuesta,solicitado_en) SELECT * FROM jsonb_to_recordset($1) d(incidencia_id int,solicitado_por int,motivo text,plazo_anterior timestamptz,plazo_solicitado timestamptz,estado text,decidido_por int,decidido_en timestamptz,respuesta text,solicitado_en timestamptz)`,[JSON.stringify(ampliaciones)]);
 return {agentes:agentes.length,incidenciasNuevas:nuevas.length};
};

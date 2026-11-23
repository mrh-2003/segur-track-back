'use strict';
// Ejemplos explícitamente sintéticos. No altera ni reinicia incidencias ingresadas por usuarios.
module.exports=async(c,{idsExplicitos=false}={})=>{
 if(!(await c.query('SELECT datos_demo FROM configuracion_operativa WHERE id=1')).rows[0]?.datos_demo)throw new Error('Solo se permite en demostración');
 const base=(await c.query(`SELECT s.id servicio_id,p.id personal_id,p.usuario_id operador,ps.usuario_id supervisor
 FROM servicios s JOIN servicio_personal sp ON sp.servicio_id=s.id AND NOT sp.eliminado
 JOIN personal p ON p.id=sp.personal_id JOIN usuarios u ON u.id=p.usuario_id AND u.rol='operador' AND u.activo AND NOT u.eliminado
 JOIN personal ps ON ps.id=s.supervisor_id JOIN usuarios us ON us.id=ps.usuario_id AND us.rol='supervisor' AND us.activo AND NOT us.eliminado
 WHERE s.codigo_externo LIKE 'DEMO-SRV-%' AND NOT s.eliminado AND NOT p.eliminado AND p.cargo='agente' AND p.estado='activo' ORDER BY s.id,p.id LIMIT 1`)).rows[0];
 if(!base)return; // La instalación mínima puede no tener todavía agentes con cuenta y servicio asignado.
 const tipo=(await c.query('SELECT id FROM tipos_incidencia WHERE NOT eliminado ORDER BY id LIMIT 1')).rows[0]?.id;if(!tipo)return;
 for(const [n,estado] of [[1,'pendiente'],[2,'rechazada'],[3,'aprobada']]){
  const idExplicito=idsExplicitos?Number((await c.query('SELECT COALESCE(MAX(id),0)+1 id FROM incidencias')).rows[0].id):null;
  const r=await c.query(`INSERT INTO incidencias(id,codigo,tipo_incidencia_id,servicio_id,personal_id,descripcion,prioridad,estado,fecha_registro,fecha_atencion,
   registrado_por,responsable_id,sla_min,sla_resolucion_min,origen_plazo,plazo_resolucion_extendido)
   VALUES(COALESCE($8::int,nextval(pg_get_serial_sequence('public.incidencias','id'))),$1,$2,$3,$4,$5,'alta','en_atencion',NOW()-INTERVAL '5 hours',NOW()-INTERVAL '4 hours 45 minutes',
   $6,$4,60,120,'demo_flujo',CASE WHEN $7='aprobada' THEN NOW()+INTERVAL '4 hours' END)
   ON CONFLICT(codigo) WHERE NOT eliminado DO NOTHING RETURNING *`,['DFL-'+String(n).padStart(3,'0'),tipo,base.servicio_id,base.personal_id,'DEMO FLUJO: corrección operativa de prueba; ampliación '+estado,base.operador,estado,idExplicito]);
  if(!r.rowCount)continue;const i=r.rows[0];
  await c.query(`INSERT INTO incidencias_ampliaciones(incidencia_id,solicitado_por,motivo,plazo_anterior,plazo_solicitado,estado,decidido_por,decidido_en,respuesta)
   VALUES($1,$2,'DEMO: se requiere apoyo técnico para completar la corrección',NOW()-INTERVAL '3 hours',NOW()+INTERVAL '4 hours',$3,
   CASE WHEN $3<>'pendiente' THEN $4::int END,CASE WHEN $3<>'pendiente' THEN NOW() END,
   CASE WHEN $3='rechazada' THEN 'DEMO: priorizar la corrección con el apoyo ya disponible' WHEN $3='aprobada' THEN 'DEMO: plazo autorizado por supervisión' END)`,[i.id,base.operador,estado,base.supervisor]);
  await c.query(`INSERT INTO incidencias_seguimiento(incidencia_id,accion,comentario,usuario_id) VALUES
   ($1,'registrar','DEMO: reporte de incidencia para probar el flujo',$2),
   ($1,'atender','DEMO: el operador inicia la corrección',$2),
   ($1,'solicitar_ampliacion','DEMO: solicitud de apoyo y plazo adicional',$2)`,[i.id,base.operador]);
  if(estado!=='pendiente')await c.query('INSERT INTO incidencias_seguimiento(incidencia_id,accion,comentario,usuario_id) VALUES($1,$2,$3,$4)',[i.id,estado==='aprobada'?'aprobar_ampliacion':'rechazar_ampliacion','DEMO: decisión de supervisión para probar la ampliación',base.supervisor]);
 }
};

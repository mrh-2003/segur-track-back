'use strict';
const pool=require('../config/db');
const tx=require('../utils/transaccion');
const {ErrorAutorizacion,ErrorConflicto,ErrorNoEncontrado,ErrorValidacion}=require('../utils/errores');
const gestores=['administrador','jefe_operaciones'];
async function actor(u,c=pool){
 if(typeof u==='object')return u;
 const r=(await c.query('SELECT id,rol FROM usuarios WHERE id=$1 AND NOT eliminado',[u])).rows[0];
 if(!r)throw new ErrorAutorizacion();return r;
}
async function alcance(u,c=pool){
 u=await actor(u,c);if(gestores.includes(u.rol))return {sql:'TRUE',params:[]};
 if(u.rol==='supervisor')return {sql:`EXISTS(SELECT 1 FROM servicios s JOIN personal p ON p.id=s.supervisor_id WHERE s.id=i.servicio_id AND p.usuario_id=$1 AND NOT p.eliminado AND NOT s.eliminado)`,params:[u.id]};
 if(u.rol==='operador')return {sql:`(i.registrado_por=$1 OR EXISTS(SELECT 1 FROM personal p WHERE p.id=i.responsable_id AND p.usuario_id=$1 AND NOT p.eliminado))`,params:[u.id]};
 throw new ErrorAutorizacion();
}
async function comprobar(i,u,c=pool,operar=false){
 u=await actor(u,c);
 const a=await alcance(u,c);
 if(!(await c.query(`SELECT 1 FROM incidencias i WHERE i.id=$${a.params.length+1} AND NOT i.eliminado AND ${a.sql}`,[...a.params,i.id])).rowCount)throw new ErrorAutorizacion('No tiene acceso a esta incidencia');
 if(operar&&!gestores.includes(u.rol)){
  if(u.rol!=='operador'||!(await c.query('SELECT 1 FROM personal WHERE id=$1 AND usuario_id=$2 AND NOT eliminado',[i.responsable_id,u.id])).rowCount)
   throw new ErrorAutorizacion('El personal operativo responsable es quien atiende y resuelve la incidencia');
 }
 return u;
}
const limite=i=>i.plazo_resolucion_extendido||new Date(+new Date(i.fecha_registro)+Number(i.sla_resolucion_min)*60000).toISOString();
async function bloquear(id,u,c,operar=true){
 const i=(await c.query('SELECT * FROM incidencias WHERE id=$1 AND NOT eliminado FOR UPDATE',[id])).rows[0];
 if(!i)throw new ErrorNoEncontrado('Incidencia no encontrada');await comprobar(i,u,c,operar);return i;
}
async function evento(c,id,accion,comentario,evidencias,u){
 await c.query('INSERT INTO incidencias_seguimiento(incidencia_id,accion,comentario,evidencias,usuario_id) VALUES($1,$2,$3,$4,$5)',[id,accion,comentario,JSON.stringify(evidencias||[]),u.id]);
}
async function detalle(id,u){
 const c=await pool.connect();try{
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const i=(await c.query(`SELECT i.*,s.nombre servicio,s.supervisor_id,p.nombres||' '||p.apellidos responsable,p.cargo responsable_cargo,ti.nombre tipo
   FROM incidencias i JOIN servicios s ON s.id=i.servicio_id JOIN tipos_incidencia ti ON ti.id=i.tipo_incidencia_id LEFT JOIN personal p ON p.id=i.responsable_id WHERE i.id=$1 AND NOT i.eliminado`,[id])).rows[0];
  if(!i)throw new ErrorNoEncontrado('Incidencia no encontrada');u=await comprobar(i,u,c);
  const seguimiento=(await c.query('SELECT e.*,u.nombre usuario FROM incidencias_seguimiento e JOIN usuarios u ON u.id=e.usuario_id WHERE incidencia_id=$1 ORDER BY e.creado_en,e.id',[id])).rows;
  const ampliaciones=(await c.query(`SELECT a.*,u.nombre solicitante,d.nombre decisor FROM incidencias_ampliaciones a JOIN usuarios u ON u.id=a.solicitado_por LEFT JOIN usuarios d ON d.id=a.decidido_por WHERE incidencia_id=$1 ORDER BY a.solicitado_en,a.id`,[id])).rows;
  let puedeOperar=false;try{await comprobar(i,u,c,true);puedeOperar=true;}catch(e){if(!(e instanceof ErrorAutorizacion))throw e;}
  const corte=(await c.query('SELECT clock_timestamp() corte')).rows[0].corte;
  const plazo=limite(i),pendiente=ampliaciones.find(a=>a.estado==='pendiente');
  await c.query('COMMIT');
  return {...i,plazo_resolucion:plazo,plazo_original:new Date(+new Date(i.fecha_registro)+Number(i.sla_resolucion_min)*60000).toISOString(),corte,
   vencida:i.estado!=='cerrada'&&+new Date(plazo)<+new Date(corte),seguimiento,ampliaciones,
   permisos:{operar:puedeOperar&&i.estado!=='cerrada',asignar:i.estado!=='cerrada'&&(gestores.includes(u.rol)||u.rol==='supervisor'),solicitar:u.rol==='supervisor'&&i.estado!=='cerrada'&&!pendiente,revisar:!!pendiente&&i.estado!=='cerrada'&&pendiente.solicitado_por!==u.id&&u.rol==='jefe_operaciones'}};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
async function actuar(id,d,u){
 u=await actor(u);return tx(u.id,'Seguimiento y resolución de incidencia',async c=>{
  const i=await bloquear(id,u,c);if(i.estado==='cerrada')throw new ErrorConflicto('La incidencia ya está resuelta');
  if(!['atender','avance','resolver'].includes(d.accion))throw new ErrorValidacion('Acción inválida');
  if(d.accion==='atender'&&i.estado!=='abierta')throw new ErrorConflicto('La atención ya fue iniciada');
  if(d.accion!=='atender'&&i.estado!=='en_atencion')throw new ErrorConflicto('Primero debe iniciar la atención');
  if(d.accion==='resolver'&&(!d.comentario||d.comentario.trim().length<10||!d.evidencias?.length))throw new ErrorValidacion('Describa la corrección y adjunte al menos una imagen para resolver');
  const comentario=d.comentario?.trim()||'Se inició la atención de la incidencia.';
  const estado=d.accion==='resolver'?'cerrada':'en_atencion';
  const r=(await c.query(`UPDATE incidencias SET estado=$2::text,fecha_atencion=COALESCE(fecha_atencion,NOW()),fecha_cierre=CASE WHEN $2::text='cerrada' THEN NOW() ELSE NULL END,
   observacion=$3,evidencias=evidencias||$4::jsonb,actualizado_en=NOW() WHERE id=$1 RETURNING *`,[id,estado,comentario,JSON.stringify(d.evidencias||[])])).rows[0];
  await evento(c,id,d.accion,comentario,d.evidencias,u);
  if(estado==='cerrada')await c.query("UPDATE incidencias_ampliaciones SET estado='cancelada',respuesta='La incidencia se resolvió antes de decidir la ampliación' WHERE incidencia_id=$1 AND estado='pendiente'",[id]);
  return r;
 });
}
async function solicitar(id,d,u){
 u=await actor(u);return tx(u.id,'Solicitud de ampliación de incidencia',async c=>{
  if(u.rol!=='supervisor')throw new ErrorAutorizacion('Solo el supervisor solicita ampliaciones');
  const i=await bloquear(id,u,c,false);if(i.estado==='cerrada')throw new ErrorConflicto('No se amplía una incidencia resuelta');
  const ahora=+(await c.query('SELECT clock_timestamp() ahora')).rows[0].ahora;
  if(!i.sla_resolucion_min)throw new ErrorConflicto('La incidencia no tiene un plazo de resolución definido');
  if(!d.motivo||d.motivo.trim().length<10)throw new ErrorValidacion('Explique por qué necesita ampliar el plazo');
  if(!Number.isFinite(+new Date(d.plazoSolicitado))||+new Date(d.plazoSolicitado)<=Math.max(ahora,+new Date(limite(i))))throw new ErrorValidacion('El nuevo plazo debe ser posterior al actual y al momento presente');
  if((await c.query("SELECT 1 FROM incidencias_ampliaciones WHERE incidencia_id=$1 AND estado='pendiente'",[id])).rowCount)throw new ErrorConflicto('Ya tiene una solicitud pendiente de aprobación');
  const r=(await c.query(`INSERT INTO incidencias_ampliaciones(incidencia_id,solicitado_por,motivo,evidencias,plazo_anterior,plazo_solicitado) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[id,u.id,d.motivo.trim(),JSON.stringify(d.evidencias||[]),limite(i),d.plazoSolicitado])).rows[0];
  await evento(c,id,'solicitar_ampliacion',d.motivo.trim(),d.evidencias,u);return r;
 });
}
async function decidir(id,solicitudId,d,u){
 u=await actor(u);return tx(u.id,'Decisión de ampliación de incidencia',async c=>{
  const i=await bloquear(id,u,c,false);
  if(u.rol!=='jefe_operaciones')throw new ErrorAutorizacion('Solo el jefe de operaciones puede decidir la ampliación');
  const s=(await c.query('SELECT * FROM incidencias_ampliaciones WHERE id=$1 AND incidencia_id=$2 FOR UPDATE',[solicitudId,id])).rows[0];
  if(!s)throw new ErrorNoEncontrado('Solicitud no encontrada');if(s.solicitado_por===u.id)throw new ErrorAutorizacion('No puede aprobar o rechazar su propia solicitud');
  if(s.estado!=='pendiente'||i.estado==='cerrada')throw new ErrorConflicto('La solicitud ya no admite una decisión');
  if(!['aprobada','rechazada'].includes(d.decision)||!d.comentario||d.comentario.trim().length<3)throw new ErrorValidacion('Indique la decisión y su justificación');
  if(d.decision==='aprobada'){
   const ahora=(await c.query('SELECT clock_timestamp() ahora')).rows[0].ahora;
   if(+new Date(s.plazo_solicitado)<=Math.max(+new Date(ahora),+new Date(limite(i))))throw new ErrorConflicto('El plazo solicitado ya venció; rechace la solicitud para que se proponga uno nuevo');
   await c.query('UPDATE incidencias SET plazo_resolucion_extendido=$2,actualizado_en=NOW() WHERE id=$1',[id,s.plazo_solicitado]);
  }
  const r=(await c.query('UPDATE incidencias_ampliaciones SET estado=$2,decidido_por=$3,decidido_en=NOW(),respuesta=$4 WHERE id=$1 RETURNING *',[solicitudId,d.decision,u.id,d.comentario.trim()])).rows[0];
  await evento(c,id,d.decision==='aprobada'?'aprobar_ampliacion':'rechazar_ampliacion',d.comentario.trim(),[],u);return r;
 });
}
module.exports={actor,alcance,comprobar,limite,detalle,actuar,solicitar,decidir,evento};

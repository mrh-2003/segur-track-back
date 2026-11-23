'use strict';
const tx=require('../utils/transaccion'),pool=require('../config/db'),flujo=require('./incidencias-flujo.service');
const {ErrorValidacion,ErrorNoEncontrado,ErrorConflicto,ErrorAutorizacion}=require('../utils/errores');
async function responsables(servicioId,u){
 const c=pool;u=await flujo.actor(u);
 if(!Number.isSafeInteger(Number(servicioId))||Number(servicioId)<=0)throw new ErrorValidacion('Seleccione un servicio');
 await require('./acceso-servicios').comprobar(Number(servicioId),u,c);
 if(u.rol==='operador'&&!(await c.query('SELECT 1 FROM servicio_personal sp JOIN personal p ON p.id=sp.personal_id WHERE sp.servicio_id=$1 AND NOT sp.eliminado AND p.usuario_id=$2 AND NOT p.eliminado',[servicioId,u.id])).rowCount)throw new ErrorAutorizacion();
 return (await c.query(`SELECT p.id,p.nombres||' '||p.apellidos nombre,(u.rol='operador' AND u.activo AND NOT u.eliminado) IS TRUE puede_operar FROM personal p JOIN servicio_personal sp ON sp.personal_id=p.id
 LEFT JOIN usuarios u ON u.id=p.usuario_id WHERE sp.servicio_id=$1 AND NOT sp.eliminado AND NOT p.eliminado AND p.estado='activo' AND p.cargo='agente'
 AND ($2::int IS NULL OR u.id=$2) ORDER BY p.apellidos,p.nombres`,[servicioId,u.rol==='operador'?u.id:null])).rows;
}
async function guardar(id,d,u){
 u=await flujo.actor(u);return tx(u.id,'Registro y asignación de incidencia',async c=>{
  const actual=id?(await c.query('SELECT * FROM incidencias WHERE id=$1 AND NOT eliminado FOR UPDATE',[id])).rows[0]:null;
  if(id&&!actual)throw new ErrorNoEncontrado('Incidencia no encontrada');
  if(actual){
   await flujo.comprobar(actual,u,c);
   if(u.rol==='operador')throw new ErrorAutorizacion('Use el flujo de atención y resolución');
   if(actual.estado==='cerrada')throw new ErrorConflicto('La incidencia ya está resuelta');
   if(d.estado!==undefined&&d.estado!==actual.estado)throw new ErrorConflicto('Use el flujo de atención y resolución para cambiar el estado');
   if((d.slaMin!==undefined&&d.slaMin!==actual.sla_min)||(d.slaResolucionMin!==undefined&&d.slaResolucionMin!==actual.sla_resolucion_min))throw new ErrorConflicto('El plazo no se edita directamente: requiere solicitud y aprobación de ampliación');
   if(d.servicioId!==undefined&&d.servicioId!==actual.servicio_id)throw new ErrorConflicto('La incidencia debe conservar su servicio de origen');
  }
  const servicioId=d.servicioId||actual?.servicio_id;
  const servicio=(await c.query('SELECT id FROM servicios WHERE id=$1 AND NOT eliminado',[servicioId])).rows[0];if(!servicio)throw new ErrorValidacion('Servicio no válido');
  await require('./acceso-servicios').comprobar(servicioId,u,c);
  const propia=(await c.query('SELECT id FROM personal WHERE usuario_id=$1 AND NOT eliminado',[u.id])).rows[0];
  let responsableId=d.responsableId||actual?.responsable_id||propia?.id;
  if(u.rol==='operador'){
   if(!(await c.query(`SELECT 1 FROM vw_operacion_turnos t JOIN personal p ON p.id=t.personal_id JOIN servicios s ON s.id=t.servicio_id WHERE t.servicio_id=$1 AND p.usuario_id=$2 AND s.estado='en_curso' AND t.inicio_programado<=NOW() AND t.fin_programado>NOW() AND t.estado IN ('confirmado','pendiente') AND t.salida_real IS NULL`,[servicioId,u.id])).rowCount)throw new ErrorAutorizacion('Solo puede reportar incidencias de su servicio activo durante su turno');
   if(!(await c.query(`SELECT 1 FROM vw_operacion_turnos t JOIN personal p ON p.id=t.personal_id WHERE t.servicio_id=$1 AND p.usuario_id=$2 AND t.inicio_programado<=NOW() AND t.fin_programado>NOW() AND t.estado IN ('confirmado','pendiente') AND t.salida_real IS NULL`,[servicioId,u.id])).rowCount)throw new ErrorAutorizacion('Solo puede reportar incidencias de su servicio activo durante su turno');
   if(!propia||responsableId!==propia.id||!(await c.query('SELECT 1 FROM servicio_personal WHERE servicio_id=$1 AND personal_id=$2 AND NOT eliminado',[servicioId,propia.id])).rowCount)throw new ErrorAutorizacion('Solo puede reportar para sus servicios y asumir su propia atención');
   if(d.slaMin!==undefined||d.slaResolucionMin!==undefined)throw new ErrorAutorizacion('Los plazos iniciales los define supervisión');
  }
  if(!actual||responsableId!==actual.responsable_id){
   const valido=(await c.query(`SELECT 1 FROM personal p JOIN servicio_personal sp ON sp.personal_id=p.id
    WHERE p.id=$1 AND sp.servicio_id=$2 AND NOT sp.eliminado AND NOT p.eliminado AND p.estado='activo' AND p.cargo='agente'`,[responsableId,servicioId])).rowCount;
   if(!valido)throw new ErrorValidacion('Seleccione un agente operativo activo asignado al servicio');
  }
  const turnoId=d.turnoId===undefined?actual?.turno_id:d.turnoId;
  if(turnoId&&!(await c.query('SELECT 1 FROM turnos WHERE id=$1 AND servicio_id=$2 AND NOT eliminado',[turnoId,servicioId])).rowCount)throw new ErrorValidacion('El turno debe pertenecer al servicio');
  if(actual){
   if(responsableId!==actual.responsable_id&&(await c.query("SELECT 1 FROM incidencias_ampliaciones WHERE incidencia_id=$1 AND estado='pendiente'",[id])).rowCount)throw new ErrorConflicto('Decida la ampliación pendiente antes de reasignar la incidencia');
   if(responsableId!==actual.responsable_id){
    const p=(await c.query('SELECT nombres,apellidos FROM personal WHERE id=$1',[responsableId])).rows[0];
    await flujo.evento(c,id,'avance','Supervisión asignó la corrección al agente '+p.nombres+' '+p.apellidos,[],u);
   }
   return (await c.query(`UPDATE incidencias SET tipo_incidencia_id=$2,descripcion=$3,prioridad=$4,responsable_id=$5,turno_id=$6,actualizado_en=NOW() WHERE id=$1 RETURNING *`,[id,d.tipoIncidenciaId||actual.tipo_incidencia_id,d.descripcion||actual.descripcion,d.prioridad||actual.prioridad,responsableId,turnoId||null])).rows[0];
  }
  const cfg=(await c.query('SELECT * FROM configuracion_operativa WHERE id=1')).rows[0];
  const n=(await c.query("SELECT nextval('seq_incidencias') n")).rows[0].n;
  const r=(await c.query(`INSERT INTO incidencias(codigo,tipo_incidencia_id,servicio_id,personal_id,descripcion,prioridad,registrado_por,responsable_id,turno_id,sla_min,sla_resolucion_min,origen_plazo,evidencias)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,['INC-'+String(n).padStart(4,'0'),d.tipoIncidenciaId,servicioId,propia?.id||d.personalId||null,d.descripcion,d.prioridad,u.id,responsableId,turnoId||null,d.slaMin||cfg['sla_'+d.prioridad],d.slaResolucionMin||cfg['resolucion_'+d.prioridad],d.slaResolucionMin?'manual':'configuracion_vigente',JSON.stringify(d.evidencias||[])])).rows[0];
  await flujo.evento(c,r.id,'registrar',d.descripcion,d.evidencias,u);return r;
 });
}
module.exports={guardar,responsables};

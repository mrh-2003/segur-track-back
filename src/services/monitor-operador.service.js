'use strict';
const pool=require('../config/db');
const {ErrorAutorizacion}=require('../utils/errores');
module.exports=async(u)=>{
 if(u.rol!=='operador')throw new ErrorAutorizacion();
 const turnos=(await pool.query(`SELECT t.*,TO_CHAR(t.fecha,'YYYY-MM-DD') fecha,s.nombre servicio,se.nombre sede,
  t.inicio_programado<=NOW() AND t.fin_programado>NOW() AND t.salida_real IS NULL AND t.estado<>'cumplido' activo
  FROM vw_operacion_turnos t JOIN servicios s ON s.id=t.servicio_id JOIN sedes se ON se.id=t.sede_id
  JOIN personal p ON p.id=t.personal_id WHERE p.usuario_id=$1 AND NOT p.eliminado AND NOT s.eliminado
  AND t.fin_programado>NOW()-INTERVAL '1 day' AND t.estado<>'cumplido'
  ORDER BY (t.inicio_programado<=NOW() AND t.fin_programado>NOW() AND t.salida_real IS NULL) DESC,t.inicio_programado LIMIT 8`,[u.id])).rows;
 const turno=turnos[0]||null;
 if(!turno)return {turno:null,proximos:[],tareas:[],incidencias:[],progreso:null};
 const datos=await require('./datos-kpi.service').listar(turno.id,u);
 const incidencias=(await pool.query(`SELECT i.id,i.codigo,i.descripcion,i.estado,i.prioridad FROM incidencias i
  WHERE NOT i.eliminado AND i.servicio_id=$1 AND (i.registrado_por=$2 OR i.responsable_id=$3)
  ORDER BY i.fecha_registro DESC`,[turno.servicio_id,u.id,turno.personal_id])).rows;
 const tareas=[...datos.obligaciones.map(o=>({id:'o'+o.id,tipo:o.tipo,descripcion:o.descripcion,completa:!!o.fecha_completada&&o.estado_revision!=='observado',fecha:o.fecha_limite})),
  ...datos.rondas.map(r=>({id:'r'+r.id,tipo:'ronda',descripcion:r.ruta,completa:!!r.fecha_completada,fecha:r.fecha_programada})),
  ...datos.catalogoConsignas.map(c=>({id:'c'+c.id,tipo:'consigna',descripcion:c.descripcion,completa:datos.consignas.filter(v=>v.consigna_id===c.id).at(-1)?.cumplida===true}))];
 const completadas=tareas.filter(t=>t.completa).length+incidencias.filter(i=>i.estado==='cerrada').length;
 const total=tareas.length+incidencias.length;
 return {turno,proximos:turnos.slice(1),tareas,incidencias,progreso:total?Math.round(completadas/total*100):null,completadas,total};
};

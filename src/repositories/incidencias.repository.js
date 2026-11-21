'use strict';
const pool=require('../config/db');
const flujo=require('../services/incidencias-flujo.service');
const plazo="COALESCE(i.plazo_resolucion_extendido,i.fecha_registro+make_interval(mins=>i.sla_resolucion_min))";
async function condiciones(f={},u){
 const a=u?await flujo.alcance(u):{sql:'TRUE',params:[]},valores=[...a.params],partes=['NOT i.eliminado',a.sql];
 const agregar=(sql,v)=>{valores.push(v);partes.push(sql.replaceAll('?',()=>'$'+valores.length));};
 if(f.q)agregar('(i.codigo ILIKE ? OR i.descripcion ILIKE ?)', '%'+f.q+'%');
 if(f.tipoId)agregar('i.tipo_incidencia_id=?',f.tipoId);
 if(f.estado)agregar('i.estado=?',f.estado);
 if(f.servicioId)agregar('i.servicio_id=?',f.servicioId);
 if(f.alerta==='vencidas')partes.push(`i.estado<>'cerrada' AND ${plazo}<NOW()`);
 if(f.alerta==='ampliaciones')partes.push("EXISTS(SELECT 1 FROM incidencias_ampliaciones a WHERE a.incidencia_id=i.id AND a.estado='pendiente')");
 return {where:partes.join(' AND '),valores};
}
const columnas=`i.*,ti.nombre tipo,s.nombre servicio,responsable.nombres||' '||responsable.apellidos responsable,u.nombre personal_registra,
 ${plazo} plazo_resolucion,i.fecha_registro+make_interval(mins=>i.sla_resolucion_min) plazo_original,
 (i.estado<>'cerrada' AND ${plazo}<NOW()) vencida,
 (i.estado='abierta' AND i.fecha_registro+make_interval(mins=>i.sla_min)<NOW()) atencion_vencida,
 EXISTS(SELECT 1 FROM incidencias_ampliaciones a WHERE a.incidencia_id=i.id AND a.estado='pendiente') ampliacion_pendiente`;
const joins=`FROM incidencias i JOIN tipos_incidencia ti ON ti.id=i.tipo_incidencia_id JOIN servicios s ON s.id=i.servicio_id
 LEFT JOIN personal responsable ON responsable.id=i.responsable_id LEFT JOIN usuarios u ON u.id=i.registrado_por`;
exports.listar=async(f={},u)=>{
 const {where,valores}=await condiciones(f,u);
 const total=Number((await pool.query(`SELECT count(*) total FROM incidencias i WHERE ${where}`,valores)).rows[0].total);
 const filas=(await pool.query(`SELECT ${columnas} ${joins} WHERE ${where}
 ORDER BY ${f.ordenReciente?'':`(i.estado<>'cerrada' AND ${plazo}<NOW()) DESC NULLS LAST,ampliacion_pendiente DESC,`}i.fecha_registro DESC,i.id DESC
 LIMIT $${valores.length+1} OFFSET $${valores.length+2}`,[...valores,f.limite||20,f.offset||0])).rows;
 return {filas,total};
};
exports.obtenerResumen=async(f={},u)=>{const {where,valores}=await condiciones(f,u);return (await pool.query(`SELECT COUNT(*) total,
 COUNT(*) FILTER(WHERE i.estado='abierta') abiertas,COUNT(*) FILTER(WHERE i.estado='en_atencion') en_atencion,COUNT(*) FILTER(WHERE i.estado='cerrada') cerradas,
 COUNT(*) FILTER(WHERE i.estado<>'cerrada' AND ${plazo}<NOW()) vencidas,
 COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM incidencias_ampliaciones a WHERE a.incidencia_id=i.id AND a.estado='pendiente')) ampliaciones
 FROM incidencias i WHERE ${where}`,valores)).rows[0];};
exports.obtenerRecientes=async(limite=5,u)=>(await exports.listar({limite,ordenReciente:true},u)).filas;
exports.obtenerPorId=async(id)=>(await pool.query(`SELECT ${columnas} ${joins} WHERE i.id=$1 AND NOT i.eliminado`,[id])).rows[0]||null;
exports.eliminar=async(id,eliminadoPor)=>(await pool.query('UPDATE incidencias SET eliminado=TRUE,eliminado_en=NOW(),eliminado_por=$2,actualizado_en=NOW() WHERE id=$1 AND NOT eliminado RETURNING id',[id,eliminadoPor])).rows[0];
exports.listarTipos=async()=>(await pool.query('SELECT id,nombre FROM tipos_incidencia WHERE NOT eliminado ORDER BY nombre')).rows;

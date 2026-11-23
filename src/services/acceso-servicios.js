'use strict';
const pool=require('../config/db');
const {ErrorAutorizacion}=require('../utils/errores');
const supervisorId=async(u,c=pool)=>u?.rol!=='supervisor'?null:(await c.query("SELECT id FROM personal WHERE usuario_id=$1 AND cargo='supervisor' AND NOT eliminado ORDER BY id LIMIT 1",[u.id])).rows[0]?.id||0;
const serviciosPermitidos=async(u,c=pool)=>{
 if(['administrador','jefe_operaciones'].includes(u?.rol))return null;
 if(u?.rol==='supervisor')return (await c.query('SELECT s.id FROM servicios s JOIN personal p ON p.id=s.supervisor_id WHERE NOT s.eliminado AND NOT p.eliminado AND p.usuario_id=$1',[u.id])).rows.map(x=>x.id);
 if(u?.rol==='operador')return (await c.query('SELECT DISTINCT s.id FROM servicios s JOIN servicio_personal sp ON sp.servicio_id=s.id JOIN personal p ON p.id=sp.personal_id WHERE NOT s.eliminado AND NOT sp.eliminado AND NOT p.eliminado AND p.usuario_id=$1',[u.id])).rows.map(x=>x.id);
 throw new ErrorAutorizacion();
};
const comprobar=async(id,u,c=pool)=>{const ids=await serviciosPermitidos(u,c);if(ids!==null&&!ids.includes(Number(id)))throw new ErrorAutorizacion('Solo puede acceder a sus servicios asignados');};
const alcancePersonal=(u,parametro='$1')=>u?.rol==='supervisor'?`(p.cargo='agente' AND (
 EXISTS(SELECT 1 FROM servicio_personal sp JOIN servicios s ON s.id=sp.servicio_id JOIN personal sup ON sup.id=s.supervisor_id WHERE sp.personal_id=p.id AND NOT sp.eliminado AND NOT s.eliminado AND NOT sup.eliminado AND sup.usuario_id=${parametro})
 OR EXISTS(SELECT 1 FROM servicios s JOIN personal sup ON sup.id=s.supervisor_id WHERE s.sede_id=p.sede_id AND NOT s.eliminado AND NOT sup.eliminado AND sup.usuario_id=${parametro})
 OR EXISTS(SELECT 1 FROM sedes se JOIN personal sup ON sup.id=se.supervisor_id WHERE se.id=p.sede_id AND NOT se.eliminado AND NOT sup.eliminado AND sup.usuario_id=${parametro})))`:u?.rol==='operador'?`p.usuario_id=${parametro}`:'TRUE';
const comprobarPersonal=async(id,u,c=pool)=>{if(!(await c.query(`SELECT 1 FROM personal p WHERE $1::int IS NOT NULL AND p.id=$2 AND NOT p.eliminado AND ${alcancePersonal(u)}`,[u.id,id])).rowCount)throw new ErrorAutorizacion('Solo puede consultar personal de sus servicios o sedes');};
const filtrarFuentes=async(data,u)=>{
 const ids=await serviciosPermitidos(u);if(ids===null)return data;
 const propios=u.rol==='operador'?(await pool.query('SELECT id FROM personal WHERE usuario_id=$1 AND NOT eliminado',[u.id])).rows.map(p=>p.id):null;
 const turnos=data.turnos.filter(t=>ids.includes(t.servicio_id)&&(!propios||propios.includes(t.personal_id))),turnoIds=new Set(turnos.map(t=>t.id));
 return {...data,servicios:data.servicios.filter(s=>ids.includes(s.id)),turnos,
 incidencias:data.incidencias.filter(i=>ids.includes(i.servicio_id)&&(!propios||propios.includes(i.responsable_id)||i.registrado_por===u.id)),
 rondas:data.rondas.filter(x=>turnoIds.has(x.turno_id)),obligaciones:data.obligaciones.filter(x=>turnoIds.has(x.turno_id)),
 verificacionesConsignas:data.verificacionesConsignas.filter(x=>turnoIds.has(x.turno_id)),evidenciasServicio:data.evidenciasServicio.filter(x=>turnoIds.has(x.turno_id))};
};
module.exports={supervisorId,comprobar,serviciosPermitidos,alcancePersonal,comprobarPersonal,filtrarFuentes};

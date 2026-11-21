'use strict';
const pool=require('../config/db');
const {ErrorAutorizacion}=require('../utils/errores');
const supervisorId=async(u,c=pool)=>{
  if(u?.rol!=='supervisor')return null;
  return (await c.query("SELECT id FROM personal WHERE usuario_id=$1 AND cargo='supervisor' AND NOT eliminado ORDER BY id LIMIT 1",[u.id])).rows[0]?.id || 0;
};
const comprobar=async(id,u,c=pool)=>{
  if(u?.rol!=='supervisor')return;
  if(!(await c.query(`SELECT 1 FROM servicios s JOIN personal p ON p.id=s.supervisor_id
    WHERE s.id=$1 AND NOT s.eliminado AND p.usuario_id=$2 AND NOT p.eliminado AND p.cargo='supervisor'`,[id,u.id])).rowCount)
    throw new ErrorAutorizacion('Solo puede acceder a los servicios asignados a usted');
};
const serviciosPermitidos=async(u,c=pool)=>u?.rol!=='supervisor'?null:
  (await c.query('SELECT s.id FROM servicios s JOIN personal p ON p.id=s.supervisor_id WHERE NOT s.eliminado AND NOT p.eliminado AND p.usuario_id=$1',[u.id])).rows.map(x=>x.id);
module.exports={supervisorId,comprobar,serviciosPermitidos};

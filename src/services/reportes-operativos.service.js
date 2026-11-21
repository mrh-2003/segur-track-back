'use strict';
const tx=require('../utils/transaccion');
const {comprobarAcceso}=require('./operacion.service');
const {ErrorValidacion,ErrorConflicto,ErrorNoEncontrado,ErrorAutorizacion}=require('../utils/errores');
exports.revisar=(turnoId,id,d,u)=>tx(u.id,'Revisión de reporte operativo',async(c)=>{
  if(!['administrador','jefe_operaciones','supervisor'].includes(u.rol))throw new ErrorAutorizacion();
  await comprobarAcceso(c,turnoId,u);
  const r=(await c.query("SELECT * FROM obligaciones_operativas WHERE id=$1 AND turno_id=$2 AND tipo='reporte' AND NOT eliminado FOR UPDATE",[id,turnoId])).rows[0];
  if(!r)throw new ErrorNoEncontrado('Reporte no encontrado');
  if(!r.fecha_completada)throw new ErrorConflicto('Primero debe entregarse el reporte');
  if(r.estado_revision!=='pendiente')throw new ErrorConflicto('Esta entrega ya fue revisada');
  if(d.estado==='observado'&&(!d.observacion||d.observacion.trim().length<3))throw new ErrorValidacion('Indique qué debe corregirse en el reporte');
  await c.query(`INSERT INTO revisiones_reportes(reporte_id,version_entrega,estado,observacion,revisado_por,fecha_entrega,contenido,evidencias)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[id,r.version_entrega,d.estado,d.observacion||null,u.id,r.fecha_completada,r.resultado,JSON.stringify(r.evidencias)]);
  return (await c.query('UPDATE obligaciones_operativas SET estado_revision=$2,revisado_por=$3,fecha_revision=NOW(),actualizado_en=NOW() WHERE id=$1 RETURNING *',[id,d.estado,u.id])).rows[0];
});

'use strict';
const pool = require('../config/db');
const tx = require('../utils/transaccion');
const { ErrorNoEncontrado, ErrorValidacion } = require('../utils/errores');

exports.obtener = async (id) => {
  if (!(await pool.query('SELECT id FROM servicios WHERE id=$1 AND NOT eliminado',[id])).rowCount)
    throw new ErrorNoEncontrado('Servicio no encontrado');
  const plan=(await pool.query('SELECT * FROM planes_operativos WHERE servicio_id=$1',[id])).rows[0];
  const plantillas=(await pool.query('SELECT * FROM plantillas_operativas WHERE servicio_id=$1 AND activo ORDER BY id',[id])).rows;
  const consignas=(await pool.query('SELECT id,descripcion FROM consignas WHERE servicio_id=$1 AND activo AND NOT eliminado ORDER BY id',[id])).rows;
  return { confirmado:Boolean(plan?.confirmado),plantillas,consignas };
};

exports.guardar = (id,d,u) => tx(u.id,'Configuración del plan operativo del servicio',async(c)=>{
  if (!(await c.query('SELECT id FROM servicios WHERE id=$1 AND NOT eliminado FOR UPDATE',[id])).rowCount)
    throw new ErrorNoEncontrado('Servicio no encontrado');
  // Las programaciones ejecutadas conservan su descripción y sus fechas.
  const existentes=(await c.query('SELECT id,tipo FROM plantillas_operativas WHERE servicio_id=$1',[id])).rows;
  const consignas=(await c.query('SELECT id,descripcion FROM consignas WHERE servicio_id=$1',[id])).rows;
  if (d.plantillas.some(x=>x.id&&!existentes.some(p=>p.id===x.id)) || d.consignas.some(x=>x.id&&!consignas.some(c=>c.id===x.id)))
    throw new ErrorValidacion('El registro debe pertenecer al servicio');
  await c.query('UPDATE plantillas_operativas SET activo=FALSE WHERE servicio_id=$1',[id]);
  await c.query('UPDATE consignas SET activo=FALSE WHERE servicio_id=$1 AND NOT eliminado',[id]);
  for(const p of d.plantillas) {
    if(p.id && existentes.some(x=>x.id===p.id && x.tipo===p.tipo)) await c.query('UPDATE plantillas_operativas SET tipo=$2,descripcion=$3,minutos_desde_inicio=$4,intervalo_min=$5,activo=TRUE WHERE id=$1',[p.id,p.tipo,p.descripcion,p.minutosDesdeInicio,p.intervaloMin]);
    else await c.query('INSERT INTO plantillas_operativas(servicio_id,tipo,descripcion,minutos_desde_inicio,intervalo_min) VALUES($1,$2,$3,$4,$5)',[id,p.tipo,p.descripcion,p.minutosDesdeInicio,p.intervaloMin]);
  }
  for(const x of d.consignas) {
    if(x.id && consignas.some(c=>c.id===x.id && c.descripcion===x.descripcion)) await c.query('UPDATE consignas SET descripcion=$2,activo=TRUE,actualizado_en=NOW() WHERE id=$1',[x.id,x.descripcion]);
    else await c.query('INSERT INTO consignas(servicio_id,descripcion) VALUES($1,$2)',[id,x.descripcion]);
  }
  await c.query('INSERT INTO planes_operativos(servicio_id,confirmado,actualizado_por) VALUES($1,TRUE,$2) ON CONFLICT(servicio_id) DO UPDATE SET confirmado=TRUE,actualizado_por=$2,actualizado_en=NOW()',[id,u.id]);
  // Reprogramar únicamente obligaciones sin ejecución de turnos que aún no inician.
  for(const tabla of ['obligaciones_operativas','rondas'])
    await c.query(`UPDATE ${tabla} o SET eliminado=TRUE,eliminado_por=$2,actualizado_en=NOW()
      FROM vw_operacion_turnos t WHERE t.id=o.turno_id AND t.servicio_id=$1 AND t.inicio_programado>NOW()
      AND o.plantilla_id IS NOT NULL AND o.fecha_completada IS NULL AND NOT o.eliminado`,[id,u.id]);
  const programados=(await c.query('SELECT programar_plan_turno(id) FROM vw_operacion_turnos WHERE servicio_id=$1 AND inicio_programado>NOW()',[id])).rowCount;
  return { confirmado:true,turnosProgramados:programados };
});

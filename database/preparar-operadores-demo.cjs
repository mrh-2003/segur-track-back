'use strict';
module.exports=async(c,{idsExplicitos=false}={})=>{
 if(!(await c.query('SELECT datos_demo FROM configuracion_operativa WHERE id=1')).rows[0]?.datos_demo)throw new Error('Solo para demostración');
 const personas=(await c.query(`SELECT DISTINCT p.* FROM personal p WHERE NOT p.eliminado AND p.estado='activo' AND p.usuario_id IS NULL AND (
  p.cargo='agente' AND EXISTS(SELECT 1 FROM servicio_personal sp JOIN servicios s ON s.id=sp.servicio_id WHERE sp.personal_id=p.id AND NOT sp.eliminado AND s.codigo_externo LIKE 'DEMO-SRV-%')
  OR p.cargo='supervisor' AND EXISTS(SELECT 1 FROM servicios s WHERE s.supervisor_id=p.id AND s.codigo_externo LIKE 'DEMO-SRV-%')) ORDER BY p.id`)).rows;
 const hash=personas.length?await require('bcryptjs').hash('DemoSegur2026!',10):null;
 for(const p of personas){
  const rol=p.cargo==='agente'?'operador':'supervisor',correo=`${rol}.${p.id}@demo.segurtrack.example`;
  const id=idsExplicitos?Number((await c.query('SELECT COALESCE(MAX(id),0)+1 id FROM usuarios')).rows[0].id):null;
  const u=(await c.query(`INSERT INTO usuarios(id,nombre,correo,clave_hash,rol,activo,debe_cambiar_clave)
   VALUES(COALESCE($1::int,nextval(pg_get_serial_sequence('public.usuarios','id'))),$2,$3,$4,$5,TRUE,FALSE)
   ON CONFLICT (lower(btrim(correo))) WHERE NOT eliminado DO UPDATE SET nombre=usuarios.nombre RETURNING id,rol,activo,eliminado`,[id,p.nombres+' '+p.apellidos,correo,hash,rol])).rows[0];
  if(u.rol!==rol||!u.activo||u.eliminado)throw new Error('Cuenta sintética existente incompatible: '+correo);
  await c.query('UPDATE personal SET usuario_id=$2 WHERE id=$1 AND usuario_id IS NULL',[p.id,u.id]);
 }
 // Reparar exclusivamente los ejemplos identificados; no inventar responsables de incidencias reales.
 const reparadas=(await c.query(`WITH propuestas AS(
  SELECT i.id,p.id personal_id FROM incidencias i JOIN servicios s ON s.id=i.servicio_id
  LEFT JOIN personal actual ON actual.id=i.responsable_id LEFT JOIN turnos t ON t.id=i.turno_id
  JOIN LATERAL(SELECT p.id FROM personal p JOIN servicio_personal sp ON sp.personal_id=p.id
   WHERE sp.servicio_id=i.servicio_id AND NOT sp.eliminado AND NOT p.eliminado AND p.cargo='agente' AND p.estado='activo'
   ORDER BY (p.id=t.personal_id) DESC NULLS LAST,(p.id=i.personal_id) DESC NULLS LAST,md5(i.id::text||':'||p.id::text) LIMIT 1)p ON TRUE
  WHERE NOT i.eliminado AND s.codigo_externo LIKE 'DEMO-SRV-%' AND COALESCE(actual.cargo,'')<>'agente'
  AND (i.descripcion LIKE '%Caso de demostración para seguimiento operativo.%' OR i.origen_plazo='demo_bi_6m')
 ) UPDATE incidencias i SET responsable_id=p.personal_id,actualizado_en=NOW() FROM propuestas p WHERE p.id=i.id RETURNING i.id`)).rows;
 const fechas=(await c.query(`WITH mover AS(SELECT id,GREATEST(fecha_registro,fecha_atencion,fecha_cierre)-NOW()+INTERVAL '30 minutes' delta
  FROM incidencias WHERE NOT eliminado AND (descripcion LIKE '%Caso de demostración para seguimiento operativo.%' OR origen_plazo='demo_bi_6m')
  AND GREATEST(fecha_registro,fecha_atencion,fecha_cierre)>NOW())
  UPDATE incidencias i SET fecha_registro=i.fecha_registro-m.delta,fecha_atencion=i.fecha_atencion-m.delta,fecha_cierre=i.fecha_cierre-m.delta,
   plazo_resolucion_extendido=i.plazo_resolucion_extendido-m.delta,actualizado_en=NOW() FROM mover m WHERE m.id=i.id RETURNING i.id`)).rows;
 return {cuentas:personas.length,responsablesCorregidos:reparadas.length,fechasDemoCorregidas:fechas.length};
};

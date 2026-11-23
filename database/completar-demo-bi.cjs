'use strict';
const pool=require('../src/config/db');
const migrar=require('../src/config/migrar');
(async()=>{
  await migrar();const c=await pool.connect();
  try{
    await c.query('BEGIN');await c.query("SET LOCAL TIME ZONE 'America/Lima'");await c.query('SELECT pg_advisory_xact_lock(741099)');
    if(!(await c.query('SELECT datos_demo FROM configuracion_operativa WHERE id=1')).rows[0]?.datos_demo)throw new Error('Solo se permite completar una base demo');
    await require('../src/services/warehouse.service').inicializarCatalogo(c);
    const actor=(await c.query("SELECT id FROM usuarios WHERE rol='administrador' AND NOT eliminado ORDER BY id LIMIT 1")).rows[0].id;
    await c.query("SELECT set_config('app.usuario_id',$1,true),set_config('app.motivo','Muestra BI de seis meses y revisión de reportes',true)",[String(actor)]);
    await c.query("UPDATE servicios SET fecha_inicio=LEAST(fecha_inicio,(DATE_TRUNC('month',CURRENT_DATE)-INTERVAL '5 months')::date) WHERE codigo_externo LIKE 'DEMO-SRV-%'");
    // Un turno semanal de prueba por servicio demo; no se alteran los turnos ya existentes.
    await c.query(`INSERT INTO turnos(servicio_id,sede_id,personal_id,fecha,hora_inicio,hora_fin,estado,creado_por,puesto,clave_importacion,asistencia_validada,ingreso_real,salida_real,evidencias_requeridas,evidencias_registradas)
      SELECT s.id,s.sede_id,p.personal_id,d::date,'06:00','14:00','cumplido',$1,'DEMO BI · Control de accesos',
      'DEMO-BI-6M-'||s.id||'-'||to_char(d,'YYYYMMDD'),TRUE,
      CASE WHEN MOD(s.id+EXTRACT(DAY FROM d)::int,13)=0 THEN NULL ELSE (d::date+TIME '06:00') AT TIME ZONE 'America/Lima'+CASE WHEN MOD(s.id+EXTRACT(DAY FROM d)::int,7)=0 THEN INTERVAL '25 minutes' ELSE INTERVAL '0' END END,
      CASE WHEN MOD(s.id+EXTRACT(DAY FROM d)::int,13)=0 THEN NULL ELSE (d::date+TIME '14:00') AT TIME ZONE 'America/Lima' END,0,0
      FROM servicios s CROSS JOIN generate_series((DATE_TRUNC('month',CURRENT_DATE)-INTERVAL '5 months')::date,CURRENT_DATE-INTERVAL '35 days',INTERVAL '7 days') d
      LEFT JOIN LATERAL(SELECT sp.personal_id FROM servicio_personal sp JOIN personal pp ON pp.id=sp.personal_id WHERE sp.servicio_id=s.id AND NOT sp.eliminado AND NOT pp.eliminado ORDER BY sp.personal_id LIMIT 1)p ON TRUE
      WHERE s.codigo_externo LIKE 'DEMO-SRV-%' AND NOT s.eliminado
      ON CONFLICT(clave_importacion) WHERE clave_importacion IS NOT NULL DO NOTHING`,[actor]);
    await c.query("UPDATE turnos SET estado=CASE WHEN ingreso_real IS NULL THEN 'pendiente' ELSE 'cumplido' END WHERE clave_importacion LIKE 'DEMO-BI-6M-%'");
    await c.query(`UPDATE obligaciones_operativas o SET fecha_completada=o.fecha_limite+CASE WHEN MOD(t.id,7)=0 THEN INTERVAL '20 minutes' ELSE INTERVAL '-5 minutes' END,
      primera_entrega_en=CASE WHEN o.tipo='reporte' THEN o.fecha_limite+CASE WHEN MOD(t.id,7)=0 THEN INTERVAL '20 minutes' ELSE INTERVAL '-5 minutes' END END,
      resultado='DEMO BI: resultado operativo histórico de prueba.',completado_por=$1,origen='demo_bi_6m'
      FROM turnos t WHERE t.id=o.turno_id AND t.clave_importacion LIKE 'DEMO-BI-6M-%' AND o.fecha_completada IS NULL AND MOD(t.id,10)<9`,[actor]);
    await c.query(`UPDATE rondas r SET fecha_completada=r.fecha_programada+INTERVAL '5 minutes',estado='completada',completado_por=$1,origen='demo_bi_6m'
      FROM turnos t WHERE t.id=r.turno_id AND t.clave_importacion LIKE 'DEMO-BI-6M-%' AND r.fecha_completada IS NULL AND MOD(t.id+r.secuencia,10)<9`,[actor]);
    await c.query(`INSERT INTO revisiones_reportes(reporte_id,version_entrega,estado,observacion,revisado_por,revisado_en,fecha_entrega,contenido,evidencias)
      SELECT o.id,o.version_entrega,CASE WHEN MOD(o.id,9)=0 THEN 'observado' ELSE 'aprobado' END,
      CASE WHEN MOD(o.id,9)=0 THEN 'DEMO BI: precisar las novedades y la acción tomada.' ELSE 'DEMO BI: revisión conforme.' END,$1,
      LEAST(o.fecha_completada+INTERVAL '30 minutes',NOW()),o.fecha_completada,o.resultado,o.evidencias
      FROM obligaciones_operativas o JOIN turnos t ON t.id=o.turno_id JOIN servicios s ON s.id=t.servicio_id
      WHERE o.tipo='reporte' AND NOT o.eliminado AND o.fecha_completada<=NOW() AND s.codigo_externo LIKE 'DEMO-SRV-%'
      AND NOT EXISTS(SELECT 1 FROM revisiones_reportes r WHERE r.reporte_id=o.id) AND MOD(o.id,5)<>0
      ON CONFLICT(reporte_id,version_entrega) DO NOTHING`,[actor]);
    await c.query(`UPDATE obligaciones_operativas o SET estado_revision=r.estado,fecha_revision=r.revisado_en,revisado_por=r.revisado_por
      FROM revisiones_reportes r WHERE r.reporte_id=o.id AND r.version_entrega=o.version_entrega AND o.estado_revision='pendiente'`);
    await c.query(`INSERT INTO incidencias(codigo,tipo_incidencia_id,servicio_id,descripcion,prioridad,estado,fecha_registro,fecha_atencion,fecha_cierre,registrado_por,responsable_id,turno_id,sla_min,sla_resolucion_min,origen_plazo)
      SELECT 'DBI-'||t.id,(SELECT MIN(id) FROM tipos_incidencia WHERE NOT eliminado),t.servicio_id,'DEMO BI: incidencia histórica de prueba para indicadores.',
      'media',CASE WHEN MOD(t.id,4)=0 THEN 'abierta' ELSE 'cerrada' END,v.inicio_programado+INTERVAL '1 hour',
      CASE WHEN MOD(t.id,4)=0 THEN NULL ELSE v.inicio_programado+INTERVAL '1 hour 20 minutes' END,
      CASE WHEN MOD(t.id,4)=0 THEN NULL ELSE v.inicio_programado+INTERVAL '3 hours' END,$1,s.supervisor_id,t.id,240,1440,'demo_bi_6m'
      FROM turnos t JOIN vw_operacion_turnos v ON v.id=t.id JOIN servicios s ON s.id=t.servicio_id
      WHERE t.clave_importacion LIKE 'DEMO-BI-6M-%' AND MOD(t.id,3)=0
      AND NOT EXISTS(SELECT 1 FROM incidencias i WHERE i.codigo='DBI-'||t.id)`,[actor]);
    // Las metas de demostración tienen vigencia en toda la muestra, sin cambiar las configuraciones de otros códigos.
    for(const x of require('./catalogo-bi.cjs'))await c.query(`INSERT INTO metas_bi(codigo,valor,vigente_desde,vigente_hasta,actualizado_por)
      SELECT $1,$2,(DATE_TRUNC('month',CURRENT_DATE)-INTERVAL '5 months')::date,
      (SELECT MIN(vigente_desde)-1 FROM metas_bi WHERE codigo=$1 AND vigente_desde>(DATE_TRUNC('month',CURRENT_DATE)-INTERVAL '5 months')::date),$3
      WHERE NOT EXISTS(SELECT 1 FROM metas_bi WHERE codigo=$1 AND vigente_desde<=(DATE_TRUNC('month',CURRENT_DATE)-INTERVAL '5 months')::date)`,[x[0],x[5],actor]);
    await require('./datos-flujo-incidencias-demo.cjs')(c);
    await require('./regularizar-flujos-demo.cjs').regularizar(c);
    await c.query('COMMIT');console.log('Muestra de seis meses y revisión de reportes completada.');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  console.log(JSON.stringify(await require('../src/services/warehouse.service').sincronizar({origen:'muestra_bi'})));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>pool.end());

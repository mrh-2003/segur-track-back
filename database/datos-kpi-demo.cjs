'use strict';
// Datos sintéticos compartidos por ambos generadores, siempre dentro de su transacción.
module.exports=async(c,opciones={})=>{
  if(!(await c.query('SELECT datos_demo FROM configuracion_operativa WHERE id=1')).rows[0]?.datos_demo) throw new Error('Se requiere una base de demostración');
    const u=(await c.query("SELECT id FROM usuarios WHERE rol='administrador' AND NOT eliminado ORDER BY id LIMIT 1")).rows[0];
    await c.query("SELECT set_config('app.usuario_id',$1,true),set_config('app.motivo','Datos de prueba KPI: programación y ejecución sintéticas',true)",[String(u.id)]);
    const servicios=(await c.query('SELECT id FROM servicios WHERE NOT eliminado ORDER BY id')).rows;
    for(const s of servicios) {
      const existe=(await c.query('SELECT 1 FROM planes_operativos WHERE servicio_id=$1',[s.id])).rowCount;
      if(!existe) {
        await c.query('INSERT INTO planes_operativos(servicio_id,confirmado,actualizado_por) VALUES($1,TRUE,$2)',[s.id,u.id]);
        await c.query(`INSERT INTO plantillas_operativas(servicio_id,tipo,descripcion,minutos_desde_inicio,intervalo_min) VALUES
          ($1,'actividad','DEMO · Inspección de accesos y equipos',60,NULL),
          ($1,'ronda','DEMO · Recorrido perimetral de vigilancia',120,120),
          ($1,'reporte','DEMO · Parte operativo de cierre de turno',NULL,NULL)`,[s.id]);
      }
      await c.query(`INSERT INTO consignas(servicio_id,descripcion)
        SELECT $1,'DEMO · Verificar accesos autorizados y comunicar novedades'
        WHERE NOT EXISTS(SELECT 1 FROM consignas WHERE servicio_id=$1 AND descripcion='DEMO · Verificar accesos autorizados y comunicar novedades')`,[s.id]);
    }
    await c.query('SELECT programar_plan_turno(id) FROM turnos WHERE NOT eliminado ORDER BY id');
    await c.query(`UPDATE obligaciones_operativas o SET origen='demo_kpis_20261118'
      FROM plantillas_operativas p WHERE p.id=o.plantilla_id AND p.descripcion LIKE 'DEMO · %' AND NOT o.eliminado AND o.origen='plan_servicio'`);
    await c.query(`UPDATE rondas r SET origen='demo_kpis_20261118'
      FROM plantillas_operativas p WHERE p.id=r.plantilla_id AND p.descripcion LIKE 'DEMO · %' AND NOT r.eliminado AND r.origen='plan_servicio'`);
    // Escenarios sintéticos variados. No se modifican ejecuciones ingresadas por usuarios.
    await c.query(`UPDATE obligaciones_operativas o SET
      fecha_completada=CASE WHEN MOD(o.turno_id+t.servicio_id,100)<
        CASE MOD(t.servicio_id,3) WHEN 0 THEN 100 WHEN 1 THEN 90 ELSE 65 END
      THEN GREATEST(COALESCE(t.ingreso_real,t.inicio_programado),o.fecha_limite+
        CASE WHEN o.tipo='reporte' AND MOD(o.turno_id,100)<CASE MOD(t.servicio_id,3) WHEN 0 THEN 0 WHEN 1 THEN 10 ELSE 25 END
        THEN INTERVAL '30 minutes' ELSE INTERVAL '-5 minutes' END) END,
      completado_por=$1,resultado=CASE WHEN o.tipo='reporte' THEN 'DEMO: parte operativo de prueba; accesos revisados y novedades comunicadas a supervisión.' ELSE 'DEMO: inspección de prueba completada por supervisión.' END,
      actualizado_en=NOW()
      FROM vw_operacion_turnos t WHERE t.id=o.turno_id AND o.origen='demo_kpis_20261118'
      AND NOT o.eliminado AND t.fin_programado+INTERVAL '30 minutes'<=NOW()`,[u.id]);
    await c.query(`UPDATE rondas r SET
      fecha_completada=CASE WHEN MOD(r.turno_id+r.secuencia+t.servicio_id,100)<CASE MOD(t.servicio_id,3) WHEN 0 THEN 100 WHEN 1 THEN 90 ELSE 65 END
        THEN GREATEST(COALESCE(t.ingreso_real,t.inicio_programado),r.fecha_programada+INTERVAL '10 minutes') END,
      estado=CASE WHEN MOD(r.turno_id+r.secuencia+t.servicio_id,100)<CASE MOD(t.servicio_id,3) WHEN 0 THEN 100 WHEN 1 THEN 90 ELSE 65 END THEN 'completada' ELSE 'programada' END,
      completado_por=$1,observaciones='DEMO: recorrido de prueba ejecutado por supervisión.',actualizado_en=NOW()
      FROM vw_operacion_turnos t WHERE t.id=r.turno_id AND r.origen='demo_kpis_20261118'
      AND NOT r.eliminado AND r.fecha_programada+INTERVAL '10 minutes'<=NOW()
      AND COALESCE(t.ingreso_real,t.inicio_programado)<=NOW()`,[u.id]);
    await c.query("UPDATE obligaciones_operativas SET resultado=NULL,completado_por=NULL WHERE origen='demo_kpis_20261118' AND fecha_completada IS NULL");
    await c.query("UPDATE rondas SET observaciones=NULL,completado_por=NULL WHERE origen='demo_kpis_20261118' AND fecha_completada IS NULL");
    await c.query(`INSERT INTO verificaciones_consignas(turno_id,consigna_id,cumplida,observacion,verificado_por,creado_en)
      SELECT t.id,cn.id,MOD(t.id+t.servicio_id,10)<9,'DEMO: verificación de consigna para pruebas KPI',$1,
      GREATEST(t.ingreso_real,t.inicio_programado+INTERVAL '30 minutes')
      FROM vw_operacion_turnos t JOIN consignas cn ON cn.servicio_id=t.servicio_id
      WHERE cn.descripcion='DEMO · Verificar accesos autorizados y comunicar novedades' AND NOT cn.eliminado
      AND t.ingreso_real IS NOT NULL AND GREATEST(t.ingreso_real,t.inicio_programado+INTERVAL '30 minutes')<=NOW()
      AND NOT EXISTS(SELECT 1 FROM verificaciones_consignas v WHERE v.turno_id=t.id AND v.consigna_id=cn.id)`,[u.id]);
    await c.query(`UPDATE incidencias i SET sla_resolucion_min=CASE i.prioridad WHEN 'alta' THEN c.resolucion_alta WHEN 'media' THEN c.resolucion_media ELSE c.resolucion_baja END,
      origen_plazo='demo_kpis_20261118' FROM configuracion_operativa c WHERE c.id=1 AND i.sla_resolucion_min IS NULL`);
    // Solo el escenario demo: validar sus casos vencidos pendientes para probar la evaluación completa.
    await c.query(`UPDATE turnos t SET asistencia_validada=TRUE FROM vw_operacion_turnos v
      WHERE v.id=t.id AND v.fin_programado<=NOW() AND NOT t.asistencia_validada`);
    await require('../src/services/warehouse.service').inicializarCatalogo(c);
    await c.query(`UPDATE obligaciones_operativas SET primera_entrega_en=COALESCE(primera_entrega_en,fecha_completada)
      WHERE tipo='reporte' AND origen='demo_kpis_20261118' AND fecha_completada IS NOT NULL`);
    await c.query(`INSERT INTO revisiones_reportes(reporte_id,version_entrega,estado,observacion,revisado_por,fecha_entrega,contenido,evidencias,revisado_en)
      SELECT o.id,o.version_entrega,CASE WHEN MOD(o.id,9)=0 THEN 'observado' ELSE 'aprobado' END,
      CASE WHEN MOD(o.id,9)=0 THEN 'DEMO: ampliar las novedades del parte operativo' END,$1,o.fecha_completada,o.resultado,o.evidencias,o.fecha_completada+INTERVAL '30 minutes'
      FROM obligaciones_operativas o WHERE o.tipo='reporte' AND o.origen='demo_kpis_20261118'
      AND o.fecha_completada+INTERVAL '30 minutes'<=NOW() AND MOD(o.id,5)<>0 ON CONFLICT DO NOTHING`,[u.id]);
    await c.query(`UPDATE obligaciones_operativas o SET estado_revision=r.estado,revisado_por=r.revisado_por,fecha_revision=r.revisado_en
      FROM revisiones_reportes r WHERE r.reporte_id=o.id AND r.version_entrega=o.version_entrega
      AND o.origen='demo_kpis_20261118' AND o.estado_revision='pendiente'`);
    await require('./preparar-operadores-demo.cjs')(c,opciones);
    await require('./datos-flujo-incidencias-demo.cjs')(c,opciones);
    await c.query('SELECT bi.refrescar()');

};

'use strict';
// Escrituras de verificación aisladas en una transacción que siempre se revierte.
const assert = require('node:assert/strict');
const pool = require('../src/config/db');
const svc = require('../src/services/datos-kpi.service');
const incidencias = require('../src/services/incidencias-operativas.service');
const repo = require('../src/repositories/operacion.repository');
const { evaluarFuentes } = require('../src/services/evaluacion-operativa');
(async () => {
  const c=await pool.connect(), originalConnect=pool.connect.bind(pool), originalQuery=pool.query.bind(pool);
  let nivel=0;
  await c.query('BEGIN');
  pool.query=(...args)=>c.query(...args);
  pool.connect=async()=>({release(){},query:async(sql,params)=>{
    if (/^BEGIN/.test(sql)) return c.query('SAVEPOINT kpi_'+(++nivel));
    if(sql==='COMMIT') return c.query('RELEASE SAVEPOINT kpi_'+(nivel--));
    if(sql==='ROLLBACK') { await c.query('ROLLBACK TO SAVEPOINT kpi_'+nivel);return c.query('RELEASE SAVEPOINT kpi_'+(nivel--)); }
    return c.query(sql,params);
  }});
  try {
    const u=(await c.query("SELECT id,rol FROM usuarios WHERE rol='administrador' AND NOT eliminado LIMIT 1")).rows[0];
    const t=(await c.query('SELECT id FROM vw_operacion_turnos WHERE fin_programado<NOW() LIMIT 1')).rows[0];
    for (const tipo of ['actividad','reporte','ronda']) {
      const r=await svc.registrar(t.id,{tipo,descripcion:'Prueba aislada KPI',fechaLimite:new Date().toISOString()},u);
      const grupo=tipo==='ronda'?'ronda':'obligacion';
      const completado=await svc.actualizar(t.id,r.id,{tipo:grupo,accion:'completar',resultado:'Contenido del reporte y resultado de prueba'},u);
      assert.ok(completado.fecha_completada);
      await assert.rejects(()=>svc.actualizar(t.id,r.id,{tipo:grupo,accion:'completar'},u));
      await svc.actualizar(t.id,r.id,{tipo:grupo,accion:'anular'},u);
    }
    await svc.registrar(t.id,{tipo:'consigna',descripcion:'Consigna de prueba aislada',cumplida:false},u);
    await svc.registrar(t.id,{tipo:'validar_plan'},u);
    assert.equal((await svc.listar(t.id,u)).plan_kpi_validado,true);
    // Probar la cadena plan del servicio -> turno nocturno -> ejecución -> monitor.
    const base=(await c.query('SELECT * FROM servicios WHERE NOT eliminado LIMIT 1')).rows[0];
    const servicio=(await c.query(`INSERT INTO servicios(nombre,cliente_id,sede_id,supervisor_id,hora_inicio,hora_fin,estado,fecha_inicio)
      VALUES('PRUEBA AISLADA PLAN KPI',$1,$2,$3,'18:00','02:00','en_curso',CURRENT_DATE-1) RETURNING *`,[base.cliente_id,base.sede_id,base.supervisor_id])).rows[0];
    const plan=require('../src/services/plan-operativo.service');
    const definicion={plantillas:[
      {tipo:'actividad',descripcion:'Control de accesos',minutosDesdeInicio:60,intervaloMin:null},
      {tipo:'ronda',descripcion:'Recorrido perimetral',minutosDesdeInicio:120,intervaloMin:120},
      {tipo:'reporte',descripcion:'Parte operativo de cierre',minutosDesdeInicio:null,intervaloMin:null},
    ],consignas:[{descripcion:'Verificar identificaciones de ingreso'}]};
    await plan.guardar(servicio.id,definicion,u);
    const opService=require('../src/services/operacion.service');
    const ayer=(await c.query("SELECT TO_CHAR((NOW() AT TIME ZONE 'America/Lima')::date-1,'YYYY-MM-DD') dia")).rows[0].dia;
    const nuevoTurno=await opService.crearTurno({servicioId:servicio.id,sedeId:servicio.sede_id,personalId:null,fecha:ayer,horaInicio:'18:00',horaFin:'02:00',puesto:'Prueba KPI',evidenciasRequeridas:0},u);
    assert.equal(nuevoTurno.plan_kpi_validado,true);
    let ejecucion=await svc.listar(nuevoTurno.id,u);
    assert.equal(ejecucion.obligaciones.length,2);assert.equal(ejecucion.rondas.length,4);
    await c.query('SELECT programar_plan_turno($1)',[nuevoTurno.id]);
    assert.equal((await svc.listar(nuevoTurno.id,u)).rondas.length,4,'Reaplicar no duplica');
    const persona=(await c.query("SELECT id FROM personal WHERE estado='activo' AND NOT eliminado LIMIT 1")).rows[0];
    const operador={id:u.id,personalId:persona.id,rol:'operador'};
    await c.query(`UPDATE turnos t SET personal_id=$2,ingreso_real=v.inicio_programado,asistencia_validada=TRUE
      FROM vw_operacion_turnos v WHERE v.id=t.id AND t.id=$1`,[nuevoTurno.id,persona.id]);
    const reporte=ejecucion.obligaciones.find(o=>o.tipo==='reporte');
    await assert.rejects(()=>svc.actualizar(nuevoTurno.id,reporte.id,{tipo:'obligacion',accion:'completar'},operador),/contenido/);
    await assert.rejects(()=>svc.registrar(nuevoTurno.id,{tipo:'validar_plan'},operador),/supervisión/);
    const otro={id:999998,personalId:999998,rol:'operador'};
    await assert.rejects(()=>svc.listar(nuevoTurno.id,otro));
    const app=require('../src/app'),server=app.listen(0,'127.0.0.1');
    await new Promise(r=>server.once('listening',r));
    try {
      const url='http://127.0.0.1:'+server.address().port+'/api/v1/datos-kpi';
      const jwt=require('jsonwebtoken'),secret=require('../src/config/env').JWT_SECRET;
      const headers={Authorization:'Bearer '+jwt.sign(operador,secret),'Content-Type':'application/json'};
      assert.equal((await fetch(url+'/servicios/'+servicio.id+'/plan',{method:'PUT',headers,body:JSON.stringify(definicion)})).status,403);
      const payload={tipo:'obligacion',accion:'completar',resultado:'Parte de prueba entregado por el agente; sin novedades.',evidencias:['https://ik.imagekit.io/prueba/foto-1.png','https://ik.imagekit.io/prueba/foto-2.png']};
      const entregado=await fetch(url+'/turnos/'+nuevoTurno.id+'/'+reporte.id,{method:'PATCH',headers,body:JSON.stringify(payload)});
      const cuerpo=await entregado.json();assert.equal(entregado.status,200,JSON.stringify(cuerpo));assert.ok(cuerpo.datos.fecha_completada);assert.deepEqual(cuerpo.datos.evidencias,payload.evidencias);
      const ronda=ejecucion.rondas[0];
      const rr=await svc.actualizar(nuevoTurno.id,ronda.id,{tipo:'ronda',accion:'completar',resultado:'Recorrido verificado',evidencias:payload.evidencias},operador);
      assert.deepEqual(rr.evidencias,payload.evidencias);
      const futuro=(await c.query(`INSERT INTO turnos(servicio_id,sede_id,fecha,hora_inicio,hora_fin,creado_por) VALUES($1,$2,CURRENT_DATE+3,'06:00','14:00',$3) RETURNING id`,[servicio.id,servicio.sede_id,u.id])).rows[0];
      const programacion=await svc.listar(futuro.id,u);assert.equal(programacion.puede_registrar,false);assert.match(programacion.motivo_bloqueo,/todavía/);
      await assert.rejects(()=>svc.actualizar(futuro.id,programacion.obligaciones[0].id,{tipo:'obligacion',accion:'completar',resultado:'Intento prematuro'},u),/todavía no comienza/);
      const catalogo=(await svc.listar(nuevoTurno.id,operador)).catalogoConsignas;
      await svc.registrar(nuevoTurno.id,{tipo:'consigna',consignaId:catalogo[0].id,cumplida:true},operador);
      await assert.rejects(()=>svc.registrar(nuevoTurno.id,{tipo:'consigna',consignaId:catalogo[0].id,cumplida:true},operador),/ya fue/);
    }finally{await new Promise(r=>server.close(r));}
    const i=(await c.query("SELECT (SELECT MIN(id) FROM tipos_incidencia WHERE NOT eliminado) tipo_incidencia_id,sp.servicio_id,p.id responsable_id FROM personal p JOIN usuarios u ON u.id=p.usuario_id JOIN servicio_personal sp ON sp.personal_id=p.id WHERE u.rol='operador' AND u.activo AND NOT u.eliminado AND NOT p.eliminado AND p.estado='activo' AND NOT sp.eliminado LIMIT 1")).rows[0];
    const nueva=await incidencias.guardar(null,{tipoIncidenciaId:i.tipo_incidencia_id,servicioId:i.servicio_id,responsableId:i.responsable_id,descripcion:'Prueba aislada de plazos independientes',prioridad:'alta'},u.id);
    assert.equal(nueva.sla_resolucion_min,240);
    await assert.rejects(()=>incidencias.guardar(nueva.id,{slaResolucionMin:480},u),/solicitud/);
    const data=await repo.fuentes();
    assert.equal(data.criterios.map(c=>c.codigo).join(','),'C01,C02,C03,C04,C05');
    assert.ok(data.turnos.every(t=>typeof t.plan_kpi_validado==='boolean'));
    const pesos=data.criterios.map(c=>({id:c.codigo,peso:Number(c.peso),umbral:Number(c.umbral)}));
    require('../src/controllers/multicriterio.controller').esquemaPesos.parse({criterios:pesos});
    await require('../src/services/multicriterio.service').actualizarPesos(pesos);
    for (const periodo of ['3','7','30','todos']) for (const turno of ['ambos','diurno','nocturno']) {
      const r=evaluarFuentes(data,{periodo,turno});
      assert.equal(r.version,'operativo-v4');
      assert.ok(r.tabla.every(s=>s.criterios.length===5 && s.puntaje===s.criticidad));
    }
    console.log(JSON.stringify({planAutomatico:true,nocturno:true,rondasPorTurno:4,permisosOperador:true,reporteConContenido:true,idempotencia:true,captura:'actividad/reporte/ronda/consigna',plazos:'crear y actualizar',filtros:12,rollback:true}));
  } finally { pool.connect=originalConnect;pool.query=originalQuery;await c.query('ROLLBACK');c.release();await pool.end(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

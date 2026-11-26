'use strict';
// Se ejecuta sobre PostgreSQL temporal, sin navegador y con rollback de cada caso de negocio.
const assert=require('node:assert/strict'),pool=require('../src/config/db');
const flujo=require('../src/services/incidencias-flujo.service'),op=require('../src/services/incidencias-operativas.service');
(async()=>{
 const c=await pool.connect(),connect=pool.connect.bind(pool),query=pool.query.bind(pool);let nivel=0,server;
 await c.query('BEGIN');pool.query=(...a)=>c.query(...a);
 pool.connect=async()=>({release(){},query:async(sql,p)=>{
  if(/^BEGIN/.test(sql))return c.query('SAVEPOINT incidencia_'+(++nivel));
  if(sql==='COMMIT')return c.query('RELEASE SAVEPOINT incidencia_'+(nivel--));
  if(sql==='ROLLBACK'){await c.query('ROLLBACK TO SAVEPOINT incidencia_'+nivel);return c.query('RELEASE SAVEPOINT incidencia_'+(nivel--));}return c.query(sql,p);
 }});
 try{
  const base=(await c.query(`SELECT s.id servicio_id,p.id personal_id,p.usuario_id operador,ps.usuario_id supervisor
    FROM servicios s JOIN servicio_personal sp ON sp.servicio_id=s.id AND NOT sp.eliminado JOIN personal p ON p.id=sp.personal_id
    JOIN usuarios u ON u.id=p.usuario_id AND u.rol='operador' AND u.activo AND NOT u.eliminado
    JOIN personal ps ON ps.id=s.supervisor_id JOIN usuarios us ON us.id=ps.usuario_id AND us.rol='supervisor' AND NOT us.eliminado
    WHERE NOT s.eliminado AND NOT p.eliminado AND p.cargo='agente' AND p.estado='activo' ORDER BY s.id LIMIT 1`)).rows[0];assert.ok(base);
  const admin=(await c.query("SELECT id,rol FROM usuarios WHERE rol='administrador' AND NOT eliminado LIMIT 1")).rows[0];
  const jefe=(await c.query("SELECT id,rol FROM usuarios WHERE rol='jefe_operaciones' AND NOT eliminado LIMIT 1")).rows[0];assert.ok(jefe);
  const operador={id:base.operador,rol:'operador',personalId:base.personal_id},sup={id:base.supervisor,rol:'supervisor'},ajeno={id:999998,rol:'operador'};
  const tipo=(await c.query('SELECT id FROM tipos_incidencia WHERE NOT eliminado LIMIT 1')).rows[0].id;
  const sinCuenta=(await c.query(`INSERT INTO personal(nombres,apellidos,documento,cargo,sede_id)
   SELECT 'PRUEBA','SIN CUENTA',$1,'agente',sede_id FROM servicios WHERE id=$2 RETURNING id`,['SC-'+Date.now(),base.servicio_id])).rows[0];
  await c.query('INSERT INTO servicio_personal(servicio_id,personal_id) VALUES($1,$2)',[base.servicio_id,sinCuenta.id]);
  const opciones=await op.responsables(base.servicio_id,sup);
  assert.equal(opciones.find(p=>p.id===sinCuenta.id)?.puede_operar,false,'El selector debe mostrar también agentes asignados que todavía no tienen cuenta');
  const i=await op.guardar(null,{responsableId:base.personal_id,tipoIncidenciaId:tipo,servicioId:base.servicio_id,descripcion:'PRUEBA: corrección operativa con ampliación',prioridad:'alta'},admin);
  await c.query("UPDATE incidencias SET fecha_registro=NOW()-INTERVAL '5 hours',sla_resolucion_min=60 WHERE id=$1",[i.id]);
  const original=(await flujo.detalle(i.id,operador)).plazo_resolucion;assert.equal((await flujo.detalle(i.id,operador)).vencida,true);
  await assert.rejects(()=>flujo.detalle(i.id,ajeno),e=>e.codigo===403);
  await assert.rejects(()=>flujo.actuar(i.id,{accion:'atender'},sup),e=>e.codigo===403);
  await assert.rejects(()=>flujo.actuar(i.id,{accion:'resolver',comentario:'Corrección todavía sin iniciar',evidencias:['https://example.test/foto.png']},operador),/Primero/);
  await assert.rejects(()=>op.guardar(i.id,{slaResolucionMin:500},admin),/solicitud/);
  await flujo.actuar(i.id,{accion:'atender'},operador);
  await assert.rejects(()=>flujo.actuar(i.id,{accion:'atender'},operador),/ya fue/);
  await flujo.actuar(i.id,{accion:'avance',comentario:'Se aisló el área y se solicitó apoyo técnico'},operador);
  const futuro=new Date(Date.now()+2*3600000).toISOString();
  await assert.rejects(()=>flujo.solicitar(i.id,{motivo:'Se requiere apoyo técnico',plazoSolicitado:original},sup),/posterior/);
  const s=await flujo.solicitar(i.id,{motivo:'El técnico requiere más tiempo para concluir la corrección',plazoSolicitado:futuro},sup);
  let d=await flujo.detalle(i.id,operador);assert.equal(+new Date(d.plazo_resolucion),+new Date(original));assert.equal(d.vencida,true);assert.equal(d.ampliaciones[0].estado,'pendiente');
  await assert.rejects(()=>flujo.solicitar(i.id,{motivo:'Otra petición de tiempo adicional',plazoSolicitado:futuro},sup),/pendiente/);
  await assert.rejects(()=>flujo.decidir(i.id,s.id,{decision:'aprobada',comentario:'Se autoriza'},operador),e=>e.codigo===403);
  await assert.rejects(()=>flujo.decidir(i.id,s.id,{decision:'aprobada',comentario:'Se autoriza'},{id:999997,rol:'supervisor'}),e=>e.codigo===403);
  assert.equal((await flujo.detalle(i.id,sup)).permisos.revisar,false);assert.equal((await flujo.detalle(i.id,jefe)).permisos.revisar,true);
  await flujo.decidir(i.id,s.id,{decision:'aprobada',comentario:'Se autoriza el apoyo técnico y el nuevo plazo'},jefe);
  d=await flujo.detalle(i.id,operador);assert.equal(d.vencida,false);assert.equal(+new Date(d.plazo_resolucion),+new Date(futuro));assert.equal(d.sla_resolucion_min,60);
  await assert.rejects(()=>flujo.decidir(i.id,s.id,{decision:'rechazada',comentario:'Segunda decisión'},jefe),/ya no/);
  const siguiente=await flujo.solicitar(i.id,{motivo:'Se requiere otra ampliación adicional del trabajo',plazoSolicitado:new Date(Date.now()+4*3600000).toISOString()},sup);
  await flujo.decidir(i.id,siguiente.id,{decision:'rechazada',comentario:'El apoyo disponible permite concluir dentro del plazo vigente'},jefe);
  assert.equal(+new Date((await flujo.detalle(i.id,operador)).plazo_resolucion),+new Date(futuro));
  const propia=await op.guardar(null,{tipoIncidenciaId:tipo,servicioId:base.servicio_id,responsableId:base.personal_id,descripcion:'PRUEBA: impedir aprobación propia de ampliación',prioridad:'alta'},admin);
  const aut=await flujo.solicitar(propia.id,{motivo:'Solicitud creada por el administrador para probar separación',plazoSolicitado:new Date(Date.now()+10*3600000).toISOString()},admin);
  await assert.rejects(()=>flujo.decidir(propia.id,aut.id,{decision:'aprobada',comentario:'Intento propio'},admin),e=>e.codigo===403);
  server=require('../src/app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const jwt=require('jsonwebtoken'),secret=require('../src/config/env').JWT_SECRET,url='http://127.0.0.1:'+server.address().port+'/api/v1';
  const api=async(path,u,method='GET',body)=>{const r=await fetch(url+path,{method,headers:{Authorization:'Bearer '+jwt.sign(u,secret),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
  assert.equal((await api(`/incidencias/${i.id}/acciones`,sup,'POST',{accion:'resolver',comentario:'Intento de cierre por supervisor',evidencias:['https://example.test/foto.png']})).status,403);
  assert.equal((await api(`/incidencias/${i.id}/acciones`,operador,'POST',{accion:'resolver',comentario:'Corrección final sin evidencia',evidencias:[]})).status,422);
  assert.equal((await api(`/incidencias/${i.id}/ampliaciones/${s.id}`,operador,'PATCH',{decision:'aprobada',comentario:'Intento de permiso'})).status,403);
  const lista=await api('/incidencias?q=PRUEBA&alerta=ampliaciones',sup);assert.equal(lista.status,200);assert.ok(lista.data.datos.some(v=>v.id===propia.id));
  const antigua=(await c.query(`INSERT INTO incidencias(codigo,tipo_incidencia_id,servicio_id,descripcion,prioridad,registrado_por,responsable_id,sla_min,sla_resolucion_min)
   SELECT 'TST-LEG',$1,s.id,'PRUEBA: asignación anterior a supervisor','alta',$2,s.supervisor_id,60,120 FROM servicios s WHERE s.id=$3 RETURNING id`,[tipo,admin.id,base.servicio_id])).rows[0];
  assert.equal((await api(`/incidencias/${antigua.id}/responsable`,operador,'PATCH',{responsableId:base.personal_id})).status,403);
  assert.equal((await api(`/incidencias/${antigua.id}/responsable`,sup,'PATCH',{responsableId:base.personal_id})).status,200);
  assert.equal((await flujo.detalle(antigua.id,operador)).permisos.operar,true);
  assert.equal((await api(`/incidencias/${propia.id}/responsable`,sup,'PATCH',{responsableId:0})).status,422);
  const etl=require('../src/services/warehouse.service');await etl.sincronizar({origen:'prueba_flujo'});
  const hecho=(await c.query('SELECT * FROM dw.fact_incidencia WHERE incidencia_origen_id=$1',[i.id])).rows[0];
  assert.equal(+new Date(hecho.limite_resolucion),+new Date(futuro));assert.equal(+new Date(hecho.limite_resolucion_original),+new Date(original));assert.equal(hecho.ampliaciones_aprobadas,1);
  const mcda=require('../src/services/multicriterio.service');
  const a=await mcda.obtenerDetallePorServicio(base.servicio_id,{periodo:'todos'},sup,base.personal_id);
  const otro=(await c.query("SELECT p.id FROM personal p JOIN servicio_personal sp ON sp.personal_id=p.id WHERE sp.servicio_id=$1 AND p.id<>$2 AND p.cargo='agente' AND NOT sp.eliminado AND NOT p.eliminado LIMIT 1",[base.servicio_id,base.personal_id])).rows[0];assert.ok(otro);
  await c.query("INSERT INTO turnos(servicio_id,sede_id,personal_id,fecha,hora_inicio,hora_fin,estado,asistencia_validada) SELECT id,sede_id,$2,CURRENT_DATE-1,'06:00','14:00','pendiente',TRUE FROM servicios WHERE id=$1",[base.servicio_id,otro.id]);
  const despues=await mcda.obtenerDetallePorServicio(base.servicio_id,{periodo:'todos'},sup,base.personal_id);
  assert.deepEqual(despues.criterios,a.criterios,'El turno incumplido de otro agente no altera sus KPI');
  const servicio=await mcda.obtenerDetallePorServicio(base.servicio_id,{periodo:'todos'},sup);assert.ok(servicio.agentes.some(p=>p.id===otro.id));assert.ok(servicio.turnos>despues.turnos);
  assert.ok(a.incidencias_resumen.resueltas>0,'El escenario debe incluir resoluciones atribuibles al operador');
  const ga=await api(`/multicriterio/servicios/${base.servicio_id}/agentes/${base.personal_id}?periodo=todos`,sup);assert.equal(ga.status,200);assert.equal(ga.data.datos.agente.id,base.personal_id);
  assert.equal((await api(`/multicriterio/servicios/${base.servicio_id}/agentes/999998`,sup)).status,404);
  await flujo.solicitar(i.id,{motivo:'Solicitud pendiente que se cancelará al resolver',plazoSolicitado:new Date(Date.now()+6*3600000).toISOString()},sup);
  const cerrado=await flujo.actuar(i.id,{accion:'resolver',comentario:'La corrección fue completada y documentada con fotografía de prueba',evidencias:['https://example.test/correccion.png']},operador);
  assert.equal(cerrado.estado,'cerrada');d=await flujo.detalle(i.id,operador);assert.equal(d.vencida,false);assert.equal(d.ampliaciones.at(-1).estado,'cancelada');assert.ok(d.seguimiento.some(e=>e.accion==='resolver'&&e.evidencias.length===1));
  await assert.rejects(()=>flujo.actuar(i.id,{accion:'avance',comentario:'Intento de reapertura'},operador),/ya está resuelta/);
  console.log(JSON.stringify({flujo:'reportar, atender, avanzar, resolver con foto',ampliaciones:'pendiente, aprobada, rechazada, cancelación y permisos',plazoOriginal:'conservado; petición no detiene el reloj',dw:'plazo efectivo, original y ampliaciones',agentes:'criterios aislados por responsable y turno',api:'permisos y validaciones comprobados',rollback:true}));
 }finally{if(server)await new Promise(r=>server.close(r));pool.query=query;pool.connect=connect;await c.query('ROLLBACK');c.release();await pool.end();}
})().catch(e=>{console.error(e);process.exitCode=1;});

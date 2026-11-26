'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pool=require('../src/config/db');
async function verificar(c){
 const originalConnect=pool.connect.bind(pool),originalQuery=pool.query.bind(pool);let nivel=0,server;
 await c.query('SAVEPOINT verificacion_total');await c.query("SET LOCAL TIME ZONE 'America/Lima'");
 pool.query=(...args)=>c.query(...args);pool.connect=async()=>({release(){},query:async(sql,p)=>{
  if(/^BEGIN/.test(sql))return c.query('SAVEPOINT verificar_'+(++nivel));
  if(sql==='COMMIT')return c.query('RELEASE SAVEPOINT verificar_'+(nivel--));
  if(sql==='ROLLBACK'){await c.query('ROLLBACK TO SAVEPOINT verificar_'+nivel);return c.query('RELEASE SAVEPOINT verificar_'+(nivel--));}return c.query(sql,p);
 }});
 const checks={};
 try{
  const lote=(await c.query("SELECT id,datos,resultado FROM importaciones WHERE datos->>'origen'='carga_auditada_dataset2' AND estado='importado'")).rows[0];assert.ok(lote);
  const users=Object.values(lote.datos.equivalencias.usuarios).map(Number),servicios=Object.values(lote.datos.equivalencias.servicios).map(Number);
  const cuentas=(await c.query('SELECT correo FROM usuarios WHERE id=ANY($1) ORDER BY id',[users])).rows;
  for(const u of cuentas){const login=await require('../src/services/auth.service').login({correo:u.correo,clave:u.correo});assert.equal(login.usuario.debeCambiarClave,true);}
  checks.cuentas_autenticadas=cuentas.length;
  const admin=(await c.query("SELECT id,rol FROM usuarios WHERE rol='administrador' AND NOT eliminado ORDER BY id LIMIT 1")).rows[0];
  const base=(await c.query(`SELECT s.id servicio_id,s.sede_id,p.id personal_id,p.usuario_id operador,ps.usuario_id supervisor FROM servicios s JOIN servicio_personal sp ON sp.servicio_id=s.id AND NOT sp.eliminado JOIN personal p ON p.id=sp.personal_id JOIN personal ps ON ps.id=s.supervisor_id WHERE s.id=ANY($1) ORDER BY s.id,p.id LIMIT 1`,[servicios])).rows[0];
  const operador={id:base.operador,rol:'operador',personalId:base.personal_id};
  const tipo=(await c.query('SELECT id FROM tipos_incidencia WHERE NOT eliminado ORDER BY id LIMIT 1')).rows[0].id;
  const directa=(await c.query(`INSERT INTO incidencias(codigo,tipo_incidencia_id,servicio_id,descripcion,prioridad,registrado_por,responsable_id) VALUES('VER-CRIT',$1,$2,'Prueba reversible de plazos predeterminados','critica',$3,$4) RETURNING sla_min,sla_resolucion_min`,[tipo,base.servicio_id,admin.id,base.personal_id])).rows[0];assert.equal(directa.sla_min,15);assert.equal(directa.sla_resolucion_min,60);checks.critica_trigger_sql=true;
  const i=await require('../src/services/incidencias-operativas.service').guardar(null,{responsableId:base.personal_id,tipoIncidenciaId:tipo,servicioId:base.servicio_id,descripcion:'Verificación transaccional de prioridad crítica después de la carga',prioridad:'critica'},admin);
  assert.equal(i.prioridad,'critica');assert.equal(i.sla_min,15);assert.equal(i.sla_resolucion_min,60);checks.critica_plazos={atencion:i.sla_min,resolucion:i.sla_resolucion_min};
  const flujo=require('../src/services/incidencias-flujo.service');await flujo.actuar(i.id,{accion:'atender',evidencias:[]},operador);await flujo.actuar(i.id,{accion:'avance',comentario:'Validación transaccional sin persistir datos de prueba',evidencias:[]},operador);
  assert.equal((await flujo.detalle(i.id,operador)).estado,'en_atencion');checks.critica_creacion_atencion_avance=true;
  await flujo.actuar(i.id,{accion:'resolver',comentario:'Cierre de prueba reversible; no se almacena ningún registro de ensayo.',evidencias:['https://example.test/solo-prueba-reversible.png']},operador);assert.equal((await flujo.detalle(i.id,operador)).estado,'cerrada');checks.critica_cierre_con_validacion=true;
  const t=await require('../src/services/operacion.service').crearTurno({personalId:base.personal_id,servicioId:base.servicio_id,sedeId:base.sede_id,fecha:'2026-11-30',horaInicio:'07:00',horaFin:'19:00',puesto:'Prueba transaccional'},admin);
  assert.ok(t.id);checks.programar_nuevo_turno=true;
  const sin=(await c.query('SELECT count(*) n FROM usuarios WHERE id=ANY($1) AND (NOT activo OR NOT debe_cambiar_clave)',[users])).rows[0];assert.equal(Number(sin.n),0);
  server=require('../src/app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const root='http://127.0.0.1:'+server.address().port+'/api/v1';
  const jwt=require('jsonwebtoken'),secret=require('../src/config/env').JWT_SECRET;
  const api=async(ruta,u)=>{const respuesta=await fetch(root+ruta,{headers:{Authorization:'Bearer '+jwt.sign(u,secret)}});assert.equal(respuesta.status,200,ruta);return respuesta.json();};
  const sup={id:base.supervisor,rol:'supervisor'};
  const lista=await api('/servicios?limite=100',sup);assert.ok(lista.datos.length>0);checks.api_servicios_supervisor=true;
  await api('/incidencias?limite=10',sup);checks.api_incidencias_supervisor=true;
  await api('/personal?limite=10',sup);checks.api_personal_supervisor=true;
  await api('/multicriterio/mi-operacion',operador);checks.api_operador=true;
  await api('/multicriterio/resultado?periodo=3&servicios='+base.servicio_id,sup);checks.api_monitor_multicriterio=true;
  await api('/bi/resumen?mes=2026-11',admin);checks.api_bi=true;
  await c.query('SET CONSTRAINTS ALL IMMEDIATE');
  fs.writeFileSync(path.resolve(__dirname,'../../outputs/auditoria_dataset/verificacion-funcional.json'),JSON.stringify({checks,pruebas_con_rollback:true},null,2));console.log(JSON.stringify(checks,null,2));
 }finally{if(server)await new Promise(r=>server.close(r));pool.connect=originalConnect;pool.query=originalQuery;await c.query('ROLLBACK TO SAVEPOINT verificacion_total');await c.query('RELEASE SAVEPOINT verificacion_total');}
}
module.exports=verificar;
if(require.main===module)(async()=>{const c=await pool.connect();try{await c.query('BEGIN');await verificar(c);}finally{await c.query('ROLLBACK');c.release();}})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(()=>pool.end());

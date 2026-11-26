'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const pool=require('../src/config/db');
(async()=>{
 const c=await pool.connect(),query=pool.query.bind(pool),connect=pool.connect.bind(pool);
 let nivel=0,server,checks=0;
 const check=(ok,msg)=>{assert.ok(ok,msg);checks++;};
 await c.query('BEGIN');
 pool.query=(...args)=>c.query(...args);
 pool.connect=async()=>({release(){},query:async(sql,params)=>{
  if(/^BEGIN/.test(sql))return c.query('SAVEPOINT sedes_'+(++nivel));
  if(sql==='COMMIT')return c.query('RELEASE SAVEPOINT sedes_'+(nivel--));
  if(sql==='ROLLBACK'){await c.query('ROLLBACK TO SAVEPOINT sedes_'+nivel);return c.query('RELEASE SAVEPOINT sedes_'+(nivel--));}
  return c.query(sql,params);
 }});
 try {
  const nombre='017_asignacion_multiple_sedes.sql';
  if(!(await c.query('SELECT 1 FROM migraciones_aplicadas WHERE nombre=$1',[nombre])).rowCount)await c.query(fs.readFileSync(path.join(__dirname,'../database/migrations',nombre),'utf8'));
  server=require('../src/app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const jwt=require('jsonwebtoken'),secret=require('../src/config/env').JWT_SECRET,suf=Date.now();
  const actor=async rol=>(await c.query('INSERT INTO usuarios(nombre,correo,clave_hash,rol) VALUES($1,$2,$3,$4) RETURNING id,rol',['PRUEBA '+rol,`sedes-${rol}-${suf}@example.test`,'hash',rol])).rows[0];
  const jefe=await actor('jefe_operaciones'),admin=await actor('administrador');
  const api=async(ruta,u,method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/v1${ruta}`,{method,headers:{Authorization:'Bearer '+jwt.sign(u,secret),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
  const cli=await api('/clientes',jefe,'POST',{nombre:'PRUEBA sedes '+suf});
  check(cli.status===201,'Jefe crea cliente: '+JSON.stringify(cli.body));
  const sedes=[];
  for(let n=0;n<3;n++){
   const s=await api('/sedes',jefe,'POST',{nombre:'PRUEBA sede '+n,clienteId:cli.body.datos.id});
   check(s.status===201&&!s.body.datos.supervisor_id,'Sede sin supervisor: '+JSON.stringify(s.body));sedes.push(s.body.datos.id);
  }
  let dni=61000000;
  const datos=(cargo,ids)=>({nombres:'PRUEBA',apellidos:cargo,documento:String(++dni),correo:`sedes-${cargo}-${dni}-${suf}@example.test`,cargo,sedeIds:ids});
  const sinSede=await api('/personal',jefe,'POST',datos('supervisor',[]));check(sinSede.status===422,'Supervisor requiere sede');
  const supDatos=datos('supervisor',sedes.slice(0,2));
  const sup=await api('/personal',jefe,'POST',supDatos);check(sup.status===201,'Crear supervisor multisede: '+JSON.stringify(sup.body));
  const supActor={id:sup.body.datos.usuario_id,rol:'supervisor'};
  const destinos=await api('/personal/sedes-asignables',supActor);check(destinos.body.datos.length===2,'Selector del supervisor solo muestra sedes permitidas');
  const listado=await api('/personal',jefe);check(listado.body.datos.find(p=>p.id===sup.body.datos.id).sede_ids.length===2,'Lista conserva sedes múltiples');
  const jefeSin=await api('/personal',admin,'POST',datos('jefe_operaciones',[]));check(jefeSin.status===201&&jefeSin.body.datos.sede_id===null,'Jefe sin sedes opcionales');
  const jefeMulti=await api('/personal',admin,'POST',datos('jefe_operaciones',sedes));check(jefeMulti.status===201,'Jefe con varias sedes');
  check((await api('/sedes?limite=10000',{id:jefeSin.body.datos.usuario_id,rol:'jefe_operaciones'})).body.datos.some(s=>s.id===sedes[2]),'Jefe sin asignaciones accede a todas las sedes');
  check((await api('/personal',jefe,'POST',datos('agente',sedes))).status===422,'Agente no acepta múltiples sedes');
  const ag=await api('/personal',jefe,'POST',datos('agente',[sedes[0]]));check(ag.status===201,'Agente con una sede');
  check((await api(`/personal/${ag.body.datos.id}/sede`,supActor,'PATCH',{sedeId:sedes[1]})).status===200,'Supervisor cambia sede de su agente');
  check((await api(`/personal/${ag.body.datos.id}/sede`,supActor,'PATCH',{sedeId:sedes[2]})).status===403,'Supervisor no traslada a sede ajena');
  check((await api(`/personal/${ag.body.datos.id}`,supActor,'PUT',datos('supervisor',[sedes[0]]))).status===403,'Supervisor no edita cargo');
  check((await api(`/personal/${ag.body.datos.id}/sede`,jefe,'PATCH',{sedeId:sedes[2]})).status===200,'Jefe cambia cualquier sede de agente');
  const agActor={id:ag.body.datos.usuario_id,rol:'operador'};
  check((await api(`/personal/${ag.body.datos.id}/sede`,agActor,'PATCH',{sedeId:sedes[0]})).status===403,'Agente no cambia su sede');
  check((await c.query('SELECT 1 FROM personal_sedes WHERE personal_id=$1',[ag.body.datos.id])).rowCount===1,'Persistencia conserva única sede');
  const externo=await api('/personal',jefe,'POST',datos('agente',[sedes[2]]));
  check((await api(`/personal/${externo.body.datos.id}/sede`,supActor,'PATCH',{sedeId:sedes[0]})).status===403,'Supervisor no modifica agente ajeno');
  check((await api('/sedes',supActor,'POST',{nombre:'PROHIBIDO',clienteId:cli.body.datos.id})).status===403,'Supervisor no crea sedes');
  const editado=await api(`/personal/${sup.body.datos.id}`,jefe,'PUT',{...supDatos,sedeIds:[sedes[1]]});check(editado.status===200,'Editar sedes de supervisor');
  check((await c.query('SELECT 1 FROM personal_sedes WHERE personal_id=$1',[sup.body.datos.id])).rowCount===1,'Reemplazo no deja asignaciones antiguas');
  const servicio=(await c.query(`INSERT INTO servicios(nombre,cliente_id,sede_id,supervisor_id,estado,hora_inicio,hora_fin,fecha_inicio) VALUES('PRUEBA eliminación',$1,$2,$3,'en_curso','07:00','19:00',CURRENT_DATE) RETURNING id`,[cli.body.datos.id,sedes[1],sup.body.datos.id])).rows[0].id;
  const tipo=(await c.query('SELECT id FROM tipos_incidencia WHERE NOT eliminado LIMIT 1')).rows[0].id;
  await c.query('INSERT INTO servicio_personal(servicio_id,personal_id) VALUES($1,$2)',[servicio,ag.body.datos.id]);
  const inc=await require('../src/services/incidencias-operativas.service').guardar(null,{servicioId:servicio,tipoIncidenciaId:tipo,responsableId:ag.body.datos.id,descripcion:'PRUEBA eliminar incidencia con registro completo',prioridad:'alta'},jefe);
  check((await api('/incidencias/'+inc.id,supActor,'DELETE')).status===403,'Supervisor no elimina incidencias');
  check((await api('/incidencias/'+inc.id,agActor,'DELETE')).status===403,'Operador no elimina incidencias');
  check((await api('/incidencias/'+inc.id,jefe,'DELETE')).status===200,'Jefe elimina incidencia');
  check((await c.query('SELECT eliminado,eliminado_por FROM incidencias WHERE id=$1',[inc.id])).rows[0].eliminado_por===jefe.id,'Borrado lógico auditado');
  check((await api('/incidencias/'+inc.id,jefe)).status===404,'Incidencia eliminada no accesible');
  await c.query('SET CONSTRAINTS ALL IMMEDIATE');
  await c.query('SAVEPOINT cardinalidad');
  await assert.rejects(()=>c.query('INSERT INTO personal_sedes VALUES($1,$2)',[ag.body.datos.id,sedes[0]]),e=>e.code==='23514');checks++;
  await c.query('ROLLBACK TO SAVEPOINT cardinalidad');
  await assert.rejects(()=>c.query('DELETE FROM personal_sedes WHERE personal_id=$1',[sup.body.datos.id]),e=>e.code==='23514');checks++;
  await c.query('ROLLBACK TO SAVEPOINT cardinalidad');
  check((await api('/incidencias/'+inc.id,admin,'DELETE')).status===404,'Borrar dos veces no cambia el historial');
  console.log(`${checks} comprobaciones correctas. Migración y datos de prueba revertidos.`);
 }finally{if(server)await new Promise(r=>server.close(r));pool.query=query;pool.connect=connect;await c.query('ROLLBACK');c.release();await pool.end();}
})().catch(e=>{console.error(e);process.exitCode=1;});

'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const pool=require('../src/config/db');
(async()=>{
 const c=await pool.connect(),oq=pool.query.bind(pool),oc=pool.connect.bind(pool);
 let nivel=0,server,checks=0;
 const check=(ok,m)=>{assert.ok(ok,m);checks++;};
 await c.query('BEGIN');
 pool.query=(...a)=>c.query(...a);
 pool.connect=async()=>({release(){},query:async(sql,p)=>{
  if(/^BEGIN/.test(sql))return c.query('SAVEPOINT admin_'+(++nivel));
  if(sql==='COMMIT')return c.query('RELEASE SAVEPOINT admin_'+(nivel--));
  if(sql==='ROLLBACK'){await c.query('ROLLBACK TO SAVEPOINT admin_'+nivel);return c.query('RELEASE SAVEPOINT admin_'+(nivel--));}
  return c.query(sql,p);
 }});
 try{
  for(const nombre of ['019_administrador_sedes_opcionales.sql','020_retirar_cargo_administrativo.sql'])
   if(!(await c.query('SELECT 1 FROM migraciones_aplicadas WHERE nombre=$1',[nombre])).rowCount)await c.query(fs.readFileSync(path.join(__dirname,'../database/migrations',nombre),'utf8'));
  const root=(await c.query("SELECT id,rol FROM usuarios WHERE rol='administrador' AND activo AND NOT eliminado ORDER BY id LIMIT 1")).rows[0];
  assert.ok(root,'Se requiere la cuenta admin conservada');
  server=require('../src/app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const jwt=require('jsonwebtoken'),secret=require('../src/config/env').JWT_SECRET,suf=Date.now();
  const api=async(ruta,u,method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/v1${ruta}`,{method,headers:{Authorization:'Bearer '+jwt.sign(u,secret),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
  let dni=63000000;
  const datos=(cargo,ids=[])=>({nombres:'PRUEBA',apellidos:cargo,documento:String(++dni),correo:`admin-test-${dni}-${suf}@example.test`,cargo,sedeIds:ids});
  const d=datos('administrador'),nuevo=await api('/personal',root,'POST',d);
  check(nuevo.status===201,'Crear administrador sin sede: '+JSON.stringify(nuevo.body));
  const p=nuevo.body.datos,admin={id:p.usuario_id,rol:'administrador'};
  check((await api('/personal',root,'POST',{...d,documento:String(++dni),correo:'retirado-'+d.correo,cargo:'administrativo'})).status===422,'La API rechaza el cargo Administrativo retirado');
  await c.query('SAVEPOINT cargo_retirado');
  await assert.rejects(()=>c.query("UPDATE personal SET cargo='administrativo' WHERE id=$1",[p.id]),e=>e.code==='23514');checks++;
  await c.query('ROLLBACK TO SAVEPOINT cargo_retirado');
  await c.query('RELEASE SAVEPOINT cargo_retirado');
  check(p.sede_id===null&&p.sede_ids.length===0,'Sede opcional persistida');
  check((await c.query('SELECT rol FROM usuarios WHERE id=$1',[admin.id])).rows[0].rol==='administrador','El cargo conserva el rol administrador');
  const login=await api('/auth/login',root,'POST',{correo:d.correo,clave:d.correo});
  check(login.status===200&&login.body.datos.usuario.rol==='administrador','La cuenta nueva inicia sesión como administrador');
  const jefeDatos=datos('jefe_operaciones'),jef=await api('/personal',root,'POST',jefeDatos);
  check(jef.status===201,'Jefe conserva sedes opcionales');
  const jefe={id:jef.body.datos.usuario_id,rol:'jefe_operaciones'};
  check((await api('/usuarios',{id:jefe.id,rol:'administrador'})).status===403,'La autorización usa el rol vigente de la cuenta, no un rol anterior del token');
  check((await api('/personal',jefe,'POST',datos('administrador'))).status===403,'Jefe no crea administradores');
  check((await api('/personal/'+jef.body.datos.id,jefe,'PUT',{...jefeDatos,cargo:'administrador'})).status===403,'Jefe no se promueve a administrador');
  for(const [ruta,method,body] of [[`/personal/${p.id}`,'PUT',d],[`/personal/${p.id}/estado`,'PATCH',{estado:'inactivo'}],[`/personal/${p.id}`,'DELETE'],[`/personal/${p.id}/reiniciar-clave`,'POST',{}]])
   check((await api(ruta,jefe,method,body)).status===403,'Jefe no gestiona cuentas administradoras: '+ruta);
  const cliente=await api('/clientes',admin,'POST',{nombre:'PRUEBA acceso global'});check(cliente.status===201,'Administrador nuevo puede crear clientes');
  const sedes=[];
  for(let n=0;n<2;n++){const s=await api('/sedes',admin,'POST',{nombre:'PRUEBA Sede '+n,clienteId:cliente.body.datos.id});check(s.status===201,'Administrador crea sedes sin supervisor');sedes.push(s.body.datos.id);}
  const dm=datos('administrador',sedes),multi=await api('/personal',admin,'POST',dm);
  check(multi.status===201,'Crear administrador con varias sedes');
  check((await api('/personal/'+multi.body.datos.id,admin,'PUT',{...dm,nombres:'PRUEBA Editada'})).status===200,'Editar administrador multisede');
  check((await c.query('SELECT 1 FROM personal_sedes WHERE personal_id=$1',[multi.body.datos.id])).rowCount===2,'Editar no pierde la segunda sede');
  check((await api('/personal/'+multi.body.datos.id,admin,'PUT',{...dm,sedeIds:[]})).status===200,'Retirar todas las sedes del administrador');
  check((await c.query('SELECT sede_id FROM personal WHERE id=$1',[multi.body.datos.id])).rows[0].sede_id===null,'Administrador vuelve a quedar sin sede');
  const sup=await api('/personal',admin,'POST',datos('supervisor',[sedes[0]])),ag=await api('/personal',admin,'POST',datos('agente',[sedes[0]]));
  check(sup.status===201&&ag.status===201,'Administrador crea supervisor y agente');
  const servicio=await api('/servicios',admin,'POST',{nombre:'PRUEBA Servicio admin',clienteId:cliente.body.datos.id,sedeId:sedes[0],supervisorId:sup.body.datos.id,horaInicio:'07:00',horaFin:'19:00',fechaInicio:'2026-01-01',fechaFin:'2030-12-31',estado:'en_curso'});
  check(servicio.status===201,'Administrador crea servicio');
  check((await api('/servicios/'+servicio.body.datos.id+'/personal',admin,'POST',{personalId:ag.body.datos.id})).status===200,'Administrador asigna personal');
  const tipo=(await c.query('SELECT id FROM tipos_incidencia WHERE NOT eliminado LIMIT 1')).rows[0].id;
  const inc=await api('/incidencias',admin,'POST',{servicioId:servicio.body.datos.id,tipoIncidenciaId:tipo,responsableId:ag.body.datos.id,descripcion:'PRUEBA administrar todas las acciones de seguimiento',prioridad:'alta'});
  check(inc.status===201,'Administrador reporta incidencia');
  const supActor={id:sup.body.datos.usuario_id,rol:'supervisor'};
  const solicitud=await api(`/incidencias/${inc.body.datos.id}/ampliaciones`,supActor,'POST',{motivo:'PRUEBA necesitamos ampliar el seguimiento',plazoSolicitado:new Date(Date.now()+15*86400000).toISOString()});
  check(solicitud.status===200,'Supervisor conserva solicitud de ampliación');
  const detalle=await api('/incidencias/'+inc.body.datos.id,admin);
  check(detalle.body.datos.permisos.revisar,'El frontend recibe permiso de revisión para administrador');
  check((await api(`/incidencias/${inc.body.datos.id}/ampliaciones/${solicitud.body.datos.id}`,admin,'PATCH',{decision:'aprobada',comentario:'PRUEBA aprobación administrativa'})).status===200,'Administrador aprueba ampliación');
  const propia=await api(`/incidencias/${inc.body.datos.id}/ampliaciones`,admin,'POST',{motivo:'PRUEBA ampliación solicitada por administración',plazoSolicitado:new Date(Date.now()+30*86400000).toISOString()});
  check(propia.status===200,'Administrador solicita ampliación');
  check((await api(`/incidencias/${inc.body.datos.id}/ampliaciones/${propia.body.datos.id}`,admin,'PATCH',{decision:'aprobada',comentario:'PRUEBA decisión propia'})).status===403,'La integridad impide aprobar una solicitud propia');
  check((await api(`/incidencias/${inc.body.datos.id}/ampliaciones/${propia.body.datos.id}`,jefe,'PATCH',{decision:'rechazada',comentario:'PRUEBA revisión por otra cuenta autorizada'})).status===200,'Jefatura conserva la aprobación o rechazo');
  check((await api('/personal/'+multi.body.datos.id+'/reiniciar-clave',admin,'POST',{})).status===200,'Administrador reinicia claves de otro administrador');
  check((await c.query('SELECT rol FROM usuarios WHERE id=$1',[multi.body.datos.usuario_id])).rows[0].rol==='administrador','Reinicio no cambia el rol');
  check((await api('/personal/'+multi.body.datos.id,admin,'DELETE')).status===200,'Administrador elimina otro administrador');
  check((await api('/clientes',{id:multi.body.datos.usuario_id,rol:'administrador'})).status===401,'Eliminar la cuenta invalida también sus sesiones anteriores');
  await c.query('SET CONSTRAINTS ALL IMMEDIATE');
  console.log(`${checks} comprobaciones de administrador, sedes opcionales y permisos correctas. Datos de prueba revertidos.`);
 }finally{if(server)await new Promise(r=>server.close(r));pool.query=oq;pool.connect=oc;await c.query('ROLLBACK');c.release();await pool.end();}
})().catch(e=>{console.error(e);process.exitCode=1;});

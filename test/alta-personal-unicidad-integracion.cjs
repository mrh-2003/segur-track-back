'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pool=require('../src/config/db');
(async()=>{
 const c=await pool.connect(),query=pool.query.bind(pool),connect=pool.connect.bind(pool);
 let nivel=0,server,checks=0;
 const check=(ok,msg)=>{assert.ok(ok,msg);checks++;};
 await c.query('BEGIN');
 pool.query=(...args)=>c.query(...args);
 pool.connect=async()=>({release(){},query:async(sql,params)=>{
  if(/^BEGIN/.test(sql))return c.query('SAVEPOINT alta_'+(++nivel));
  if(sql==='COMMIT')return c.query('RELEASE SAVEPOINT alta_'+(nivel--));
  if(sql==='ROLLBACK'){await c.query('ROLLBACK TO SAVEPOINT alta_'+nivel);return c.query('RELEASE SAVEPOINT alta_'+(nivel--));}
  return c.query(sql,params);
 }});
 try{
  const migracion='018_unicidad_cuentas_activas.sql';
  if(!(await c.query('SELECT 1 FROM migraciones_aplicadas WHERE nombre=$1',[migracion])).rowCount)
   await c.query(fs.readFileSync(path.join(__dirname,'../database/migrations',migracion),'utf8'));
  const suf=Date.now(),correo=`alta-jefe-${suf}@example.test`;
  const admin=(await c.query("INSERT INTO usuarios(nombre,correo,clave_hash,rol) VALUES('PRUEBA admin',$1,'hash','administrador') RETURNING id,rol",[`alta-admin-${suf}@example.test`])).rows[0];
  const sede=(await c.query("INSERT INTO sedes(nombre) VALUES('PRUEBA alta sin supervisor') RETURNING id")).rows[0].id;
  server=require('../src/app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const jwt=require('jsonwebtoken'),token=jwt.sign(admin,require('../src/config/env').JWT_SECRET);
  const api=async(ruta,method,body)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/v1${ruta}`,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
  let numero=62000000;
  const dni=async()=>{do{numero++;}while((await c.query('SELECT 1 FROM personal WHERE documento=$1',[String(numero)])).rowCount);return String(numero);};
  const datos={nombres:'PRUEBA',apellidos:'Jefe de operaciones',documento:await dni(),correo,cargo:'jefe_operaciones',sedeIds:[]};
  const primero=await api('/personal','POST',datos);
  check(primero.status===201,'Crear jefe sin sedes: '+JSON.stringify(primero.body));
  check((await api('/personal/'+primero.body.datos.id,'DELETE')).status===200,'Eliminar jefe antes de reutilizar su correo');
  const segundo=await api('/personal','POST',datos);
  check(segundo.status===201,'Recrear jefe con correo y DNI de registro eliminado: '+JSON.stringify(segundo.body));
  check(segundo.body.datos.usuario_id!==primero.body.datos.usuario_id,'La cuenta nueva conserva una identidad propia');
  const anterior=(await c.query('SELECT eliminado,activo,correo FROM usuarios WHERE id=$1',[primero.body.datos.usuario_id])).rows[0];
  check(anterior.eliminado&&!anterior.activo&&anterior.correo===correo,'La cuenta anterior mantiene su historial y permanece deshabilitada');
  const auth=await require('../src/repositories/auth.repository').buscarPorCorreo(correo);
  check(auth.id===segundo.body.datos.usuario_id&&auth.rol==='jefe_operaciones','La autenticación encuentra únicamente al jefe nuevo');
  const duplicado=await api('/personal','POST',{...datos,documento:await dni(),correo:correo.toUpperCase()});
  check(duplicado.status===409&&/correo/i.test(duplicado.body.mensaje),'Duplicado activo explica el conflicto de correo');
  const repetido=await api('/personal','POST',{...datos,correo:`otro-${correo}`});
  check(repetido.status===409&&/DNI/.test(repetido.body.mensaje),'DNI activo duplicado muestra su motivo exacto');
  check(repetido.body.errores.some(e=>e.campo==='documento'),'El conflicto identifica el campo DNI');
  check(!(await c.query('SELECT 1 FROM usuarios WHERE correo=$1 AND NOT eliminado',[`otro-${correo}`])).rowCount,'Un alta rechazada no deja una cuenta huérfana');
  const multisede=await api('/personal','POST',{...datos,correo:`multisede-${correo}`,documento:await dni(),sedeIds:[sede]});
  check(multisede.status===201,'Jefe con sede opcional también se crea');
  const enlace=await api('/personal','POST',{...datos,correo:admin.correo||`alta-admin-${suf}@example.test`,documento:await dni(),usuarioId:admin.id});
  check(enlace.status===409,'No se puede convertir una cuenta administradora en otro perfil desde el alta');
  check((await c.query('SELECT rol FROM usuarios WHERE id=$1',[admin.id])).rows[0].rol==='administrador','El intento no altera permisos de la cuenta existente');
  const huerfano=(await c.query("INSERT INTO personal(nombres,apellidos,documento,correo,cargo) VALUES('PRUEBA','Sin cuenta',$1,$2,'jefe_operaciones') RETURNING id",[await dni(),`sin-cuenta-${correo}`])).rows[0];
  check((await api('/personal/'+huerfano.id+'/reiniciar-clave','POST',{})).status===200,'La recuperación de perfiles sin cuenta funciona con el nuevo índice');
  await c.query('SET CONSTRAINTS ALL IMMEDIATE');
  console.log(`${checks} comprobaciones de alta, unicidad, cuentas eliminadas y permisos correctas. Datos de prueba revertidos.`);
 }finally{if(server)await new Promise(r=>server.close(r));pool.query=query;pool.connect=connect;await c.query('ROLLBACK');c.release();await pool.end();}
})().catch(e=>{console.error(e);process.exitCode=1;});

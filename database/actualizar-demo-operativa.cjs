'use strict';
const fs=require('node:fs'),path=require('node:path'),pool=require('../src/config/db');
(async()=>{
 await require('../src/config/migrar')();const c=await pool.connect();
 try{
  await c.query(fs.readFileSync(path.join(__dirname,'actualizar_fechas_a_hoy.sql'),'utf8'));
  await c.query('BEGIN');await c.query("SET LOCAL TIME ZONE 'America/Lima'");await c.query('SELECT pg_advisory_xact_lock(741101)');
  const admin=(await c.query("SELECT id FROM usuarios WHERE rol='administrador' AND NOT eliminado ORDER BY id LIMIT 1")).rows[0].id;
  await c.query("SELECT set_config('app.usuario_id',$1,true),set_config('app.motivo','Completar escenario de demostración: responsables operativos y estados de incidencias',true)",[String(admin)]);
  const cuentas=await require('./preparar-operadores-demo.cjs')(c);
  const escenarios=await require('./escenarios-incidencias-demo.cjs')(c);
  await require('./regularizar-flujos-demo.cjs').regularizar(c);
  await c.query('COMMIT');console.log(JSON.stringify({cuentas,escenarios}));
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 console.log(JSON.stringify(await require('../src/services/warehouse.service').sincronizar({origen:'actualizacion_demo'})));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());

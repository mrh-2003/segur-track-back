'use strict';
// Todas las mutaciones se revierten, incluso las cargas dimensionales.
const assert=require('node:assert/strict');
const pool=require('../src/config/db');
const etl=require('../src/services/warehouse.service');
const dw=require('../src/repositories/warehouse.repository');
const kpi=require('../src/services/datos-kpi.service');
const revision=require('../src/services/reportes-operativos.service');
(async()=>{
 const c=await pool.connect(),connect=pool.connect.bind(pool),query=pool.query.bind(pool);
 let nivel=0,server;
 await c.query('BEGIN');
 pool.query=(...a)=>c.query(...a);
 pool.connect=async()=>({release(){},query:async(sql,p)=>{
  if(/^BEGIN/.test(sql))return c.query('SAVEPOINT dw_'+(++nivel));
  if(sql==='COMMIT')return c.query('RELEASE SAVEPOINT dw_'+(nivel--));
  if(sql==='ROLLBACK'){await c.query('ROLLBACK TO SAVEPOINT dw_'+nivel);return c.query('RELEASE SAVEPOINT dw_'+(nivel--));}
  return c.query(sql,p);
 }});
 const cargar=async()=>{await c.query('DROP TABLE IF EXISTS pg_temp._dw_turnos');return etl.sincronizar({origen:'prueba_rollback'});};
 try{
  const admin=(await c.query("SELECT id,rol FROM usuarios WHERE rol='administrador' AND NOT eliminado LIMIT 1")).rows[0];
  const sup=(await c.query("SELECT u.id,u.rol,p.id AS \"personalId\" FROM usuarios u JOIN personal p ON p.usuario_id=u.id JOIN servicios s ON s.supervisor_id=p.id WHERE u.rol='supervisor' AND NOT u.eliminado AND NOT s.eliminado LIMIT 1")).rows[0];
  assert.ok(sup,'Se necesita un supervisor de prueba asignado');
  const propios=(await c.query('SELECT id FROM servicios WHERE supervisor_id=$1 AND NOT eliminado',[sup.personalId])).rows.map(x=>x.id);
  const ajeno=(await c.query('SELECT id FROM servicios WHERE supervisor_id<>$1 AND NOT eliminado LIMIT 1',[sup.personalId])).rows[0];
  server=require('../src/app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const jwt=require('jsonwebtoken'),secret=require('../src/config/env').JWT_SECRET;
  const base='http://127.0.0.1:'+server.address().port+'/api/v1';
  const api=async(url,u=sup,method='GET',body)=>{const r=await fetch(base+url,{method,headers:{Authorization:'Bearer '+jwt.sign(u,secret),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
  const list=await api('/servicios?limite=100&supervisorId=9999');assert.equal(list.status,200);assert.ok(list.body.datos.length>0);assert.ok(list.body.datos.every(s=>propios.includes(s.id)));
  for(const ruta of ['/servicios/'+ajeno.id,'/servicios/'+ajeno.id+'/detalle-operativo','/datos-kpi/servicios/'+ajeno.id+'/plan'])assert.equal((await api(ruta)).status,403,ruta);
  assert.deepEqual((await api('/servicios',{id:-999,rol:'supervisor'})).body.datos,[]);
  assert.equal((await api('/bi/sincronizar',sup,'POST')).status,403);
  assert.equal((await api('/bi/metas',sup,'PUT',{vigenteDesde:'2026-11-19',metas:[{codigo:'I01',valor:90}]})).status,403);
  const catalogs=await dw.catalogos(sup);assert.ok(catalogs.servicios.every(s=>propios.includes(s.id)));
  assert.ok((await dw.resumen({periodo:180},sup)).servicios.every(s=>propios.includes(s.id)));
  const t=(await c.query('SELECT id FROM vw_operacion_turnos WHERE fin_programado<NOW() LIMIT 1')).rows[0];
  let reporte=await kpi.registrar(t.id,{tipo:'reporte',descripcion:'PRUEBA BI aislada',fechaLimite:new Date().toISOString()},admin);
  reporte=await kpi.actualizar(t.id,reporte.id,{tipo:'obligacion',accion:'completar',resultado:'Primera entrega de prueba'},admin);
  const primera=+new Date(reporte.primera_entrega_en);
  await assert.rejects(()=>revision.revisar(t.id,reporte.id,{estado:'observado',observacion:''},admin),/corregirse/);
  await revision.revisar(t.id,reporte.id,{estado:'observado',observacion:'Ampliar detalle del control'},admin);
  await assert.rejects(()=>revision.revisar(t.id,reporte.id,{estado:'aprobado'},admin),/ya fue revisada/);
  reporte=await kpi.actualizar(t.id,reporte.id,{tipo:'obligacion',accion:'completar',resultado:'Corrección con detalle completo'},admin);
  assert.equal(reporte.version_entrega,2);assert.equal(reporte.estado_revision,'pendiente');assert.equal(+new Date(reporte.primera_entrega_en),primera);
  await revision.revisar(t.id,reporte.id,{estado:'aprobado'},admin);
  assert.equal((await c.query('SELECT * FROM revisiones_reportes WHERE reporte_id=$1',[reporte.id])).rowCount,2);
  assert.equal((await c.query('SELECT 1 FROM dw.fact_obligacion WHERE obligacion_origen_id=$1',[reporte.id])).rowCount,0,'Sin ETL los datos nuevos no llegan al DW');
  await cargar();
  const hecho=(await c.query('SELECT * FROM dw.fact_obligacion WHERE obligacion_origen_id=$1',[reporte.id])).rows[0];assert.equal(hecho.observados,1);assert.equal(hecho.revisados,1);
  const cnt=async()=>Number((await c.query('SELECT count(*) n FROM dw.fact_obligacion')).rows[0].n);
  const n=await cnt();await cargar();assert.equal(await cnt(),n,'Repetir ETL no duplica hechos');
  const r=await dw.resumen({periodo:180},admin);assert.equal(r.indicadores.length,14);assert.equal(r.evolucion.length,6);assert.ok(r.indicadores.every(i=>i.valor!==null));
  assert.ok(Math.abs(r.indicadores.find(i=>i.codigo==='I01').valor-100*r.totales.cubiertos/r.totales.exigibles)<1e-8);
  const sk=(await c.query('SELECT servicio_sk FROM dw.fact_turno WHERE turno_origen_id=$1',[t.id])).rows[0].servicio_sk;
  const sid=(await c.query('SELECT servicio_id FROM turnos WHERE id=$1',[t.id])).rows[0].servicio_id;
  await c.query("UPDATE servicios SET nombre=nombre||' prueba SCD' WHERE id=$1",[sid]);await cargar();
  const versiones=(await c.query('SELECT sk,actual FROM dw.dim_servicio WHERE origen_id=$1',[sid])).rows;
  assert.ok(versiones.length>=2);assert.equal(versiones.filter(x=>x.actual).length,1);
  assert.equal((await c.query('SELECT servicio_sk FROM dw.fact_turno WHERE turno_origen_id=$1',[t.id])).rows[0].servicio_sk,sk,'El hecho pasado conserva su versión histórica');
  const cross=(await c.query("SELECT 1 FROM pg_constraint co JOIN pg_namespace n ON n.oid=co.connamespace JOIN pg_class p ON p.oid=co.confrelid JOIN pg_namespace np ON np.oid=p.relnamespace WHERE co.contype='f' AND n.nspname='dw' AND np.nspname<>'dw'")).rowCount;assert.equal(cross,0);
  assert.equal((await etl.sincronizar({soloSiVence:true})).omitido,true);
  const lock=await connect();try{await lock.query('SELECT pg_advisory_lock(741098)');assert.equal((await etl.sincronizar()).en_curso,true);}finally{await lock.query('SELECT pg_advisory_unlock(741098)');lock.release();}
  const before=(await c.query('SELECT ultima_carga_en FROM etl.estado')).rows[0].ultima_carga_en;
  const def=(await c.query("SELECT pg_get_functiondef('etl.cargar_dw(bigint,timestamp with time zone)'::regprocedure) sql")).rows[0].sql;
  await c.query("CREATE OR REPLACE FUNCTION etl.cargar_dw(p_carga bigint,p_corte timestamptz) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Error simulado de prueba'; END $$");
  await assert.rejects(()=>cargar(),/Error simulado/);assert.equal(await cnt(),n);assert.equal(+(await c.query('SELECT ultima_carga_en FROM etl.estado')).rows[0].ultima_carga_en,+before);
  await c.query(def);
  const metas=require('../src/services/metas-bi.service');
  await metas.guardar({vigenteDesde:'2026-12-01',metas:[{codigo:'I01',valor:99}]},admin);
  await metas.guardar({vigenteDesde:'2026-11-25',metas:[{codigo:'I01',valor:97}]},admin);
  const m=(await c.query("SELECT to_char(vigente_hasta,'YYYY-MM-DD') hasta FROM metas_bi WHERE codigo='I01' AND vigente_desde='2026-11-25'")).rows[0];assert.equal(m.hasta,'2026-11-30');
  console.log(JSON.stringify({supervisor:'lista, parámetros manipulados, detalle, plan y BI protegidos',reportes:'observar/corregir/aprobar; historial sin duplicar',etl:'aislamiento, idempotencia, SCD2, exclusión mutua, intervalo y rollback atómico',indicadores:14,meses:6,fkOperativas:0,metas:'históricas',rollback:true}));
 }finally{if(server)await new Promise(r=>server.close(r));pool.connect=connect;pool.query=query;await c.query('ROLLBACK');c.release();await pool.end();}
})().catch(e=>{console.error(e);process.exitCode=1;});

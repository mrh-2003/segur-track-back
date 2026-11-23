'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const pool=require('../src/config/db');
const flujo=require('./regularizar-flujos-demo.cjs');
async function huellaProtegidos(c){
 return (await c.query(`SELECT
  (SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,'')) FROM turnos t WHERE t.id NOT IN(SELECT id FROM flujo_demo_turnos)) turnos,
  (SELECT md5(COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.id)::text,'')) FROM incidencias i WHERE i.id NOT IN(SELECT id FROM flujo_demo_incidencias)) incidencias`)).rows[0];
}
async function respaldar(c){
 const tablas={
  servicios:"codigo_externo LIKE 'DEMO-SRV-%'",
  sedes:"id IN(SELECT sede_id FROM servicios WHERE codigo_externo LIKE 'DEMO-SRV-%')",
  personal:'id IN(SELECT personal_id FROM flujo_demo_turnos)',
  turnos:'id IN(SELECT id FROM flujo_demo_turnos)',
  turnos_historial:'turno_id IN(SELECT id FROM flujo_demo_turnos)',
  servicio_personal:'servicio_id IN(SELECT DISTINCT servicio_id FROM flujo_demo_turnos)',
  obligaciones_operativas:'turno_id IN(SELECT id FROM flujo_demo_turnos)',
  rondas:'turno_id IN(SELECT id FROM flujo_demo_turnos)',
  verificaciones_consignas:'turno_id IN(SELECT id FROM flujo_demo_turnos)',
  revisiones_reportes:'reporte_id IN(SELECT id FROM obligaciones_operativas WHERE turno_id IN(SELECT id FROM flujo_demo_turnos))',
  incidencias:'id IN(SELECT id FROM flujo_demo_incidencias)',
  incidencias_seguimiento:'incidencia_id IN(SELECT id FROM flujo_demo_incidencias)',
  incidencias_ampliaciones:'incidencia_id IN(SELECT id FROM flujo_demo_incidencias)',
 };
 const datos={fecha:new Date().toISOString(),motivo:'Respaldo previo a regularizar exclusivamente los flujos DEMO',tablas:{}};
 for(const [tabla,where]of Object.entries(tablas))datos.tablas[tabla]=(await c.query(`SELECT * FROM ${tabla} WHERE ${where}`)).rows;
 const destino=path.resolve(__dirname,'../../analisis/respaldo-flujos-demo-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json.gz');
 fs.writeFileSync(destino,zlib.gzipSync(Buffer.from(JSON.stringify(datos))),{flag:'wx'});
 return destino;
}
(async()=>{
 const aplicar=process.argv.includes('--aplicar'),soloAuditar=process.argv.includes('--auditar');
 const c=await pool.connect();let resultado;
 try{
  await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='15s'");await c.query("SET LOCAL TIME ZONE 'America/Lima'");
  await c.query('SELECT pg_advisory_xact_lock(741110)');
  const antes=await flujo.auditar(c);
  if(soloAuditar){await c.query('ROLLBACK');console.log(JSON.stringify({auditoria:antes},null,2));return;}
  const huella=await huellaProtegidos(c);
  const respaldo=aplicar?await respaldar(c):null;
  resultado=await flujo.regularizar(c);
  const segunda=await flujo.regularizar(c);
  assert.ok(Object.values(segunda.cambios).every(n=>n===0),'La segunda pasada produjo cambios: '+JSON.stringify(Object.fromEntries(Object.entries(segunda.cambios).filter(([,n])=>n!==0))));
  assert.deepEqual(await huellaProtegidos(c),huella,'No se deben modificar turnos ni incidencias ajenos a los ejemplos identificados');
  if(aplicar)await c.query('COMMIT');else await c.query('ROLLBACK');
  console.log(JSON.stringify({modo:aplicar?'aplicado':'ensayo con rollback',respaldo,idempotente:true,antes,...resultado},null,2));
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 if(aplicar&&!process.argv.includes('--sin-bi'))console.log(JSON.stringify({bi:await require('../src/services/warehouse.service').sincronizar({origen:'regularizacion_flujos_demo'})}));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());

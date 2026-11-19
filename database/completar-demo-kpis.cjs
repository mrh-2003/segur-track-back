'use strict';
// Complemento sintético idempotente: conserva los datos existentes y no reinicia tablas.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const pool=require('../src/config/db');
const migrar=require('../src/config/migrar');
async function completar() {
  await migrar();
  const c=await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query("SET LOCAL TIME ZONE 'America/Lima'");
    await c.query('SELECT pg_advisory_xact_lock(741097)');
    if(!(await c.query('SELECT datos_demo FROM configuracion_operativa WHERE id=1 FOR UPDATE')).rows[0]?.datos_demo)
      throw new Error('Este complemento solo se permite en una base identificada como demostración');
    await require('./datos-kpi-demo.cjs')(c);
    const conteos=(await c.query(`SELECT
      (SELECT COUNT(*) FROM planes_operativos WHERE confirmado) planes,
      (SELECT COUNT(*) FROM plantillas_operativas WHERE activo) plantillas,
      (SELECT COUNT(*) FROM obligaciones_operativas WHERE NOT eliminado) obligaciones,
      (SELECT COUNT(*) FROM rondas WHERE NOT eliminado) rondas,
      (SELECT COUNT(*) FROM verificaciones_consignas) verificaciones,
      (SELECT COUNT(*) FROM incidencias WHERE NOT eliminado AND sla_resolucion_min IS NULL) incidencias_sin_plazo`)).rows[0];
    assert.equal(Number(conteos.incidencias_sin_plazo),0);
    await c.query('COMMIT');
    const data=await require('../src/repositories/operacion.repository').fuentes();
    const {evaluarFuentes}=require('../src/services/evaluacion-operativa');
    const pruebas=[];
    for(const periodo of ['3','7','30','todos'])for(const turno of ['ambos','diurno','nocturno']) {
      const r=evaluarFuentes(data,{periodo,turno});
      assert.ok(r.tabla.every(s=>s.criterios.slice(2).every(k=>k.estado!=='Faltan datos')),`Faltantes: ${periodo}/${turno}`);
      pruebas.push({periodo,turno,evaluados:r.resumen.evaluados,servicios:r.resumen.total});
    }
    const r=evaluarFuentes(data,{periodo:'30'});
    const actor=(await pool.query("SELECT id FROM usuarios WHERE rol='administrador' AND NOT eliminado ORDER BY id LIMIT 1")).rows[0];
    for(const servicio of r.tabla) await pool.query(`INSERT INTO evaluaciones_operativas(servicio_id,usuario_id,version,filtros,resultado)
      SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS(SELECT 1 FROM evaluaciones_operativas WHERE servicio_id=$1 AND version=$3 AND resultado=$5::jsonb)`,
      [servicio.id,actor.id,r.version,r.filtros,servicio]);
    const resultado={generado:new Date().toISOString(),demo:true,conteos,pruebas,servicios:r.tabla.map(s=>({id:s.id,servicio:s.nombre,criticidad:s.criticidad,criterios:s.criterios.map(k=>({codigo:k.codigo,estado:k.estado,tasa:k.tasa,kpi01:k.kpi01,kpi02:k.kpi02}))}))};
    if(!process.argv.includes('--sin-informe')) fs.writeFileSync(path.join(__dirname,'../../analisis/datos-prueba-kpis-2026-11-18.json'),JSON.stringify(resultado,null,2));
    console.log(JSON.stringify({conteos,combinaciones:pruebas.length,evaluados:r.resumen.evaluados,servicios:r.resumen.total}));
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
completar().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>pool.end());

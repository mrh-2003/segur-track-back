'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const pool=require('../src/config/db');
(async()=>{const c=await pool.connect();try{
 await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const lote=(await c.query("SELECT id,resultado,datos FROM importaciones WHERE datos->>'origen'='carga_auditada_dataset2' AND estado='importado'")).rows[0];assert.ok(lote);
 const resultado={lote:lote.id,carga:lote.resultado,tablas:{},integridad:{},originales_conservados:[],bi:{}};
 for(const t of ['usuarios','clientes','sedes','personal','personal_sedes','servicios','servicio_personal','tipos_incidencia','turnos','incidencias','incidencias_seguimiento','protocolos','servicio_protocolos','evidencias_servicio','criterios_mcda','evaluaciones_multicriterio','evaluacion_criterios','reportes_generados','actividad_reciente'])resultado.tablas[t]=Number((await c.query(`SELECT count(*) n FROM ${t}`)).rows[0].n);
 const fk=(await c.query(`SELECT conname,c.conrelid::regclass::text tabla,c.confrelid::regclass::text padre,
  array_agg(a.attname::text ORDER BY k.ord) columnas,array_agg(b.attname::text ORDER BY k.ord) referidas
  FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey,c.confkey) WITH ORDINALITY k(a,b,ord)
  JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.a JOIN pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=k.b
  WHERE contype='f' AND connamespace IN('public'::regnamespace,'dw'::regnamespace) GROUP BY c.oid`)).rows;
 const identificador=s=>'"'+s.replaceAll('"','""')+'"';
 const partes=fk.map(f=>`SELECT '${f.conname}' restriccion,count(*)::int errores FROM ${f.tabla} h WHERE ${f.columnas.map(a=>'h.'+identificador(a)+' IS NOT NULL').join(' AND ')} AND NOT EXISTS(SELECT 1 FROM ${f.padre} p WHERE ${f.columnas.map((a,i)=>'h.'+identificador(a)+'=p.'+identificador(f.referidas[i])).join(' AND ')})`);
 const errores=(await c.query(partes.join(' UNION ALL '))).rows.filter(r=>r.errores>0);assert.deepEqual(errores,[]);resultado.integridad={claves_foraneas_verificadas:fk.length,huerfanos:0};
 const tmp=path.resolve(__dirname,'../tmp'),back=fs.readdirSync(tmp).filter(n=>n.startsWith('respaldo-antes-dataset2-')).sort().at(-1),backup=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(tmp,back))));
 for(const tabla of ['usuarios','clientes','sedes','personal','servicios','turnos','incidencias','tipos_incidencia','criterios_mcda']){
  const original=backup.tablas['public.'+tabla],ids=original.map(r=>r.id),actual=JSON.parse(JSON.stringify((await c.query(`SELECT * FROM ${tabla} WHERE id=ANY($1::int[]) ORDER BY id`,[ids])).rows));
  assert.deepEqual(actual,original.sort((a,b)=>a.id-b.id),'Datos previos modificados en '+tabla);resultado.originales_conservados.push(tabla);
 }
 const turnoIds=Object.values(lote.datos.equivalencias.turnos).map(Number),incIds=Object.values(lote.datos.equivalencias.incidencias).map(Number);
 resultado.bi.turnos=Number((await c.query('SELECT count(*) n FROM dw.fact_turno WHERE turno_origen_id=ANY($1)',[turnoIds])).rows[0].n);
 resultado.bi.incidencias=Number((await c.query('SELECT count(*) n FROM dw.fact_incidencia WHERE incidencia_origen_id=ANY($1)',[incIds])).rows[0].n);
 assert.equal(resultado.bi.turnos,lote.resultado.turnos);assert.equal(resultado.bi.incidencias,lote.resultado.incidencias);
 resultado.bi.estado=(await c.query('SELECT * FROM etl.estado WHERE id=1')).rows[0];
 resultado.revisiones=(await c.query('SELECT estado_revision,count(*)::int cantidad FROM evidencias_servicio GROUP BY 1')).rows;
 resultado.servicios_activos=Number((await c.query("SELECT count(*) n FROM servicios WHERE id=ANY($1::int[]) AND estado='en_curso' AND fecha_fin IS NULL",[Object.values(lote.datos.equivalencias.servicios).map(Number)])).rows[0].n);assert.equal(resultado.servicios_activos,40);
 resultado.prioridades=(await c.query('SELECT prioridad,count(*)::int cantidad FROM incidencias GROUP BY 1 ORDER BY 1')).rows;
 await c.query('ROLLBACK');fs.writeFileSync(path.resolve(__dirname,'../../outputs/auditoria_dataset/auditoria-final.json'),JSON.stringify(resultado,null,2));console.log(JSON.stringify(resultado,null,2));
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(()=>pool.end());

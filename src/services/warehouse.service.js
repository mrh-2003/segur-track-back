'use strict';
const pool=require('../config/db');
const catalogo=require('../../database/catalogo-bi.cjs');
async function inicializarCatalogo(c){
  const datos=JSON.stringify(catalogo.map(x=>({codigo:x[0],nombre:x[1],unidad:x[2],sentido:x[3],formula:x[4],meta:x[5]})));
  await c.query(`INSERT INTO indicadores_bi(codigo,nombre,unidad,sentido,formula)
    SELECT codigo,nombre,unidad,sentido,formula FROM jsonb_to_recordset($1) x(codigo text,nombre text,unidad text,sentido text,formula text,meta numeric) ON CONFLICT DO NOTHING`,[datos]);
  await c.query(`INSERT INTO metas_bi(codigo,valor,vigente_desde)
    SELECT x.codigo,x.meta,CURRENT_DATE FROM jsonb_to_recordset($1) x(codigo text,meta numeric)
    WHERE NOT EXISTS(SELECT 1 FROM metas_bi m WHERE m.codigo=x.codigo)`,[datos]);
}
async function sincronizar({origen='manual',usuarioId=null,soloSiVence=false}={}){
  const c=await pool.connect();let bloqueado=false,id=null;
  try{
    bloqueado=(await c.query('SELECT pg_try_advisory_lock(741098) adquirido')).rows[0].adquirido;
    if(!bloqueado)return {en_curso:true};
    const estado=(await c.query('SELECT *,ultima_carga_en IS NULL OR ultima_carga_en<=NOW()-INTERVAL \'60 minutes\' vencido FROM etl.estado WHERE id=1')).rows[0];
    if(soloSiVence&&!estado.vencido)return {omitido:true,ultima_carga_en:estado.ultima_carga_en};
    await inicializarCatalogo(c);
    await c.query("UPDATE etl.ejecuciones SET estado='interrumpido',finalizado_en=NOW(),error='El proceso anterior terminó antes de completar la carga' WHERE estado='ejecutando'");
    id=(await c.query("INSERT INTO etl.ejecuciones(origen,usuario_origen_id,estado) VALUES($1,$2,'ejecutando') RETURNING id",[origen,usuarioId])).rows[0].id;
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await c.query("SET LOCAL TIME ZONE 'America/Lima'");
    await c.query("SET LOCAL lock_timeout='30s'");
    const corte=(await c.query('SELECT clock_timestamp() corte')).rows[0].corte;
    const detalle=(await c.query('SELECT etl.cargar_dw($1,$2) detalle',[id,corte])).rows[0].detalle;
    await c.query("UPDATE etl.ejecuciones SET estado='completado',finalizado_en=clock_timestamp(),detalle=$2 WHERE id=$1",[id,detalle]);
    await c.query('COMMIT');
    return {completado:true,cargaId:id,corte,detalle};
  }catch(e){
    await c.query('ROLLBACK');
    if(id)await c.query("UPDATE etl.ejecuciones SET estado='error',finalizado_en=clock_timestamp(),error=$2 WHERE id=$1",[id,String(e.message).slice(0,500)]);
    throw e;
  }finally{
    if(bloqueado)await c.query('SELECT pg_advisory_unlock(741098)');
    c.release();
  }
}
async function estado(){
  const s=(await pool.query('SELECT * FROM etl.estado WHERE id=1')).rows[0];
  const ultima=(await pool.query('SELECT id,origen,iniciado_en,finalizado_en,estado,detalle FROM etl.ejecuciones ORDER BY id DESC LIMIT 1')).rows[0]||null;
  return {...s,proxima_carga_en:s.ultima_carga_en?new Date(+new Date(s.ultima_carga_en)+3600000).toISOString():null,ultima};
}
function iniciarJob(){
  let detenido=false,timer;
  const ejecutar=async()=>{
    let espera=60000;
    try{
      const r=await sincronizar({origen:'job_60_min',soloSiVence:true});
      if(!r.en_curso){const s=await estado();espera=s.ultima_carga_en?Math.max(1000,+new Date(s.ultima_carga_en)+3600000-Date.now()):60000;}
    }catch(e){process.stderr.write('Falló la sincronización BI: '+e.message+'\n');}
    if(!detenido){timer=setTimeout(ejecutar,espera);timer.unref();}
  };
  ejecutar();return()=>{detenido=true;if(timer)clearTimeout(timer);};
}
module.exports={sincronizar,estado,iniciarJob,inicializarCatalogo};

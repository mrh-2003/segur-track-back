'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const pool=require('../src/config/db');
(async()=>{const c=await pool.connect();try{
 await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const tablas=(await c.query(`SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN('public','dw','etl','bi') ORDER BY 1,2`)).rows;
 const backup={fecha:new Date().toISOString(),motivo:'Antes de integrar Dataset 2 y prioridad critica',tablas:{},columnas:[],restricciones:[],funciones:[],secuencias:[]};
 for(const t of tablas) backup.tablas[t.schemaname+'.'+t.tablename]=(await c.query(`SELECT * FROM "${t.schemaname}"."${t.tablename}"`)).rows;
 backup.columnas=(await c.query(`SELECT * FROM information_schema.columns WHERE table_schema IN('public','dw','etl','bi') ORDER BY table_schema,table_name,ordinal_position`)).rows;
 backup.restricciones=(await c.query(`SELECT conrelid::regclass::text tabla,conname,pg_get_constraintdef(oid) definicion FROM pg_constraint WHERE connamespace='public'::regnamespace`)).rows;
 backup.funciones=(await c.query(`SELECT proname,pg_get_functiondef(oid) definicion FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f'`)).rows;
 backup.secuencias=(await c.query(`SELECT * FROM pg_sequences WHERE schemaname IN('public','dw','etl','bi')`)).rows;
 await c.query('ROLLBACK');
 const dir=path.resolve(__dirname,'../tmp');fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,'respaldo-antes-dataset2-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json.gz');
 fs.writeFileSync(file,zlib.gzipSync(JSON.stringify(backup)),{flag:'wx'});
 console.log(JSON.stringify({respaldo:file,tablas:tablas.length,registros:Object.values(backup.tablas).reduce((s,r)=>s+r.length,0)}));
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>pool.end());

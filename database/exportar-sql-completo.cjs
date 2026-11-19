'use strict';
// Exportación de solo lectura. Las contraseñas se normalizan únicamente en el archivo de ejemplo.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');
const pool = require('../src/config/db');
const bin = process.env.PG_DUMP || 'C:/Program Files/PostgreSQL/18/bin/pg_dump.exe';
const carpeta = path.join(__dirname, 'instalacion');
const limpiar = (s) => s.replace(/^\\(?:un)?restrict\b.*\r?\n/gm, '').replace(/^ALTER TABLE ONLY .+ ALTER COLUMN .+ SET \(pg_attver=\d+\);\r?\n/gm, '').replace(/^-- PostgreSQL database dump complete[\s\S]*$/, '-- Fin de la exportación.\n');

(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const demo = (await c.query('SELECT datos_demo FROM configuracion_operativa WHERE id=1')).rows[0];
    if (!demo?.datos_demo) throw new Error('La base no está identificada como demostración');
    const { snapshot, fecha } = (await c.query('SELECT pg_export_snapshot() snapshot,NOW() fecha')).rows[0];
    const tablas = (await c.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','bi') ORDER BY schemaname,tablename")).rows;
    const usuarios = (await c.query('SELECT id,correo,activo FROM usuarios ORDER BY id')).rows;
    const conteos = [];
    const ejecutar = (opciones) => {
      const r = spawnSync(bin, ['--no-owner','--no-privileges','--lock-wait-timeout=10s','--schema=public','--schema=bi','--encoding=UTF8',`--snapshot=${snapshot}`,...opciones], {
        env:{...process.env,PGHOST:env.DB_HOST,PGPORT:String(env.DB_PORT),PGDATABASE:env.DB_NAME,PGUSER:env.DB_USER,PGPASSWORD:env.DB_PASSWORD,PGSSLMODE:env.DB_HOST==='localhost' ? 'prefer' : 'require'},
        encoding:'utf8',maxBuffer:100*1024*1024,windowsHide:true,timeout:120000,
      });
      if(r.error) throw r.error;
      if(r.status!==0) throw new Error(r.stderr || 'Falló pg_dump');
      return limpiar(r.stdout);
    };
    const estructura = ejecutar(['--schema-only']).replace(/^CREATE SCHEMA public;$/m, 'CREATE SCHEMA IF NOT EXISTS public;');
    // Un hash no se puede desencriptar. Para una instalación reproducible de prueba,
    // todas las cuentas del SQL reciben la contraseña de demostración conocida.
    const clave = 'DemoSegur2026!';
    const hash = await bcrypt.hash(clave,10);
    if(!await bcrypt.compare(clave,hash)) throw new Error('Hash de demostración inválido');
    const quote = (v) => v === null ? 'NULL' : "'"+String(v).replace(/'/g,"''")+"'";
    const id = (v) => '"'+v.replace(/"/g,'""')+'"';
    const referencias = (await c.query("SELECT ns.nspname||'.'||cl.relname hijo,np.nspname||'.'||cp.relname padre FROM pg_constraint co JOIN pg_class cl ON cl.oid=co.conrelid JOIN pg_namespace ns ON ns.oid=cl.relnamespace JOIN pg_class cp ON cp.oid=co.confrelid JOIN pg_namespace np ON np.oid=cp.relnamespace WHERE co.contype='f' AND ns.nspname IN ('public','bi')")).rows;
    const pendientes = [...tablas], orden = [], terminadas = new Set();
    while(pendientes.length) {
      const i=pendientes.findIndex(t=>referencias.filter(r=>r.hijo===t.schemaname+'.'+t.tablename && r.padre!==r.hijo).every(r=>terminadas.has(r.padre)));
      if(i<0) throw new Error('Dependencias circulares entre tablas');
      const t=pendientes.splice(i,1)[0];orden.push(t);terminadas.add(t.schemaname+'.'+t.tablename);
    }
    const partes=['SET standard_conforming_strings = on;','SET TIME ZONE \'America/Lima\';'];
    for(const t of orden) {
      const nombre=id(t.schemaname)+'.'+id(t.tablename);
      const columnas=(await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND is_generated='NEVER' ORDER BY ordinal_position",[t.schemaname,t.tablename])).rows.map(x=>x.column_name);
      // PostgreSQL convierte a texto sin pérdida de precisión. Al insertar,
      // cada literal adopta el tipo de su columna (JSONB, BYTEA, arrays, fechas, etc.).
      const filas=(await c.query('SELECT '+columnas.map(k=>id(k)+'::text AS '+id(k)).join(',')+' FROM '+nombre)).rows;
      conteos.push({tabla:t.schemaname+'.'+t.tablename,filas:filas.length});
      partes.push('\n-- '+t.schemaname+'.'+t.tablename+' · '+filas.length+' registros');
      const lote=t.tablename==='usuarios' ? Math.max(filas.length,1) : 100;
      for(let a=0;a<filas.length;a+=lote) {
        const valores=filas.slice(a,a+lote).map(f=>'('+columnas.map(k=>quote(t.schemaname==='public' && t.tablename==='usuarios' && k==='clave_hash' ? hash : f[k])).join(', ')+')');
        partes.push('INSERT INTO '+nombre+' ('+columnas.map(id).join(', ')+') VALUES\n'+valores.join(',\n')+';');
      }
    }
    const secuencias=(await c.query("SELECT sequence_schema,sequence_name FROM information_schema.sequences WHERE sequence_schema IN ('public','bi') ORDER BY sequence_schema,sequence_name")).rows;
    partes.push('\n-- Secuencias: próximos IDs y códigos de incidencias.');
    for(const s of secuencias) {
      const nombre=id(s.sequence_schema)+'.'+id(s.sequence_name);
      const v=(await c.query('SELECT last_value::text,is_called FROM '+nombre)).rows[0];
      partes.push('SELECT pg_catalog.setval('+quote(nombre)+', '+quote(v.last_value)+', '+(v.is_called ? 'true' : 'false')+');');
    }
    const datos=partes.join('\n');
    const encabezado = `-- Segur Track · instalación completa · generado ${fecha.toISOString()}\n-- PostgreSQL. Ejecutar con psql; detenerse ante cualquier error.\n\\encoding UTF8\n`;
    const sqlCreacion = encabezado + `\\set ON_ERROR_STOP on\n-- Crear una base NUEVA. Si ya existe, este script se detiene sin borrarla.\n-- Se admite otro nombre: psql -v nombre_base=mi_base -f 01_creacion_completa.sql\n\\if :{?nombre_base}\n\\else\n\\set nombre_base segur_track\n\\endif\nCREATE DATABASE :"nombre_base" WITH TEMPLATE template0 ENCODING 'UTF8';\n\\connect :nombre_base\nBEGIN;\nCREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;\n` + estructura + '\nCOMMIT;\n';
    const activar = (accion) => tablas.map((t) => `ALTER TABLE "${t.schemaname}"."${t.tablename}" ${accion} TRIGGER USER;`).join('\n');
    const credenciales = usuarios.map((u) => `-- # ${u.correo} | contraseña: ${clave}${u.activo ? '' : ' | cuenta inactiva'}`).join('\n');
    const sqlDatos = encabezado + `\\set ON_ERROR_STOP on\n\\if :{?nombre_base}\n\\else\n\\set nombre_base segur_track\n\\endif\n\\connect :nombre_base\n-- Cargar después de 01_creacion_completa.sql, en las tablas vacías.\n-- Contiene datos sintéticos y todos los INSERT, incluidos auditoría, BI y migraciones.\nBEGIN;\n` + activar('DISABLE') + '\n' + datos + '\n' + activar('ENABLE') + '\nCOMMIT;\n\n-- CREDENCIALES DE EJEMPLO EN TEXTO CLARO (comentarios, no datos almacenados).\n' + credenciales + '\n';
    fs.mkdirSync(carpeta,{recursive:true});
    fs.writeFileSync(path.join(carpeta,'01_creacion_completa.sql'),sqlCreacion,'utf8');
    fs.writeFileSync(path.join(carpeta,'02_inserts_ejemplo.sql'),sqlDatos,'utf8');
    fs.writeFileSync(path.join(carpeta,'conteos.json'),JSON.stringify({generado:fecha,tablas:conteos,filas:conteos.reduce((n,t)=>n+t.filas,0)},null,2),'utf8');
    await c.query('COMMIT');
    console.log(JSON.stringify({carpeta,tablas:tablas.length,filas:conteos.reduce((n,t)=>n+t.filas,0),cuentas:usuarios.length}));
  } catch(e) {await c.query('ROLLBACK');throw e;}
  finally {c.release();await pool.end();}
})().catch((e)=>{console.error(e.message);process.exitCode=1;});

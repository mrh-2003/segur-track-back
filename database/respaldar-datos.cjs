'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const pool = require('../src/config/db');
(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const info = (
      await c.query('SELECT current_database() AS base,NOW() AS fecha')
    ).rows[0];
    const tablas = (
      await c.query(
        "SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','bi','dw','etl') ORDER BY schemaname,tablename"
      )
    ).rows;
    const respaldo = { ...info, tablas: [], secuencias: [] };
    for (const t of tablas) {
      const filas = (
        await c.query(`SELECT * FROM "${t.schemaname}"."${t.tablename}"`)
      ).rows;
      respaldo.tablas.push({ ...t, filas });
    }
    const sec = (
      await c.query(
        "SELECT sequence_schema,sequence_name FROM information_schema.sequences WHERE sequence_schema IN ('public','bi','dw','etl')"
      )
    ).rows;
    for (const s of sec)
      respaldo.secuencias.push({
        ...s,
        ...(
          await c.query(
            `SELECT last_value,is_called FROM "${s.sequence_schema}"."${s.sequence_name}"`
          )
        ).rows[0],
      });
    await c.query('COMMIT');
    const contenido = Buffer.from(JSON.stringify(respaldo)),
      comprimido = zlib.gzipSync(contenido),
      huella = crypto.createHash('sha256').update(comprimido).digest('hex');
    const destino = path.resolve(
      __dirname,
      '../../analisis/respaldo-antes-demo-' +
        new Date().toISOString().replace(/[:.]/g, '-') +
        '.json.gz'
    );
    fs.writeFileSync(destino, comprimido, { flag: 'wx' });
    const comprobado = JSON.parse(zlib.gunzipSync(fs.readFileSync(destino)));
    if (comprobado.tablas.length !== tablas.length)
      throw new Error('Respaldo incompleto');
    const manifest = {
      base: info.base,
      archivo: destino,
      sha256: huella,
      tablas: respaldo.tablas.map((t) => ({
        nombre: t.schemaname + '.' + t.tablename,
        filas: t.filas.length,
      })),
      secuencias: respaldo.secuencias.length,
    };
    fs.writeFileSync(
      destino + '.manifest.json',
      JSON.stringify(manifest, null, 2)
    );
    console.log(
      JSON.stringify({
        respaldo: destino,
        verificado: true,
        tablas: tablas.length,
        filas: respaldo.tablas.reduce((n, t) => n + t.filas.length, 0),
        sha256: huella,
      })
    );
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

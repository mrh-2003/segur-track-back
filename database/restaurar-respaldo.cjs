'use strict';
const fs = require('node:fs');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const pool = require('../src/config/db');
const seguro = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error('Identificador no válido');
  return '"' + s + '"';
};
(async () => {
  const indice = process.argv.indexOf('--archivo'),
    archivo = process.argv[indice + 1];
  if (indice < 0 || !archivo)
    throw new Error(
      'Indique --archivo respaldo.json.gz; use --aplicar únicamente para restaurar.'
    );
  const bytes = fs.readFileSync(archivo),
    manifest = JSON.parse(fs.readFileSync(archivo + '.manifest.json', 'utf8'));
  if (
    crypto.createHash('sha256').update(bytes).digest('hex') !== manifest.sha256
  )
    throw new Error('La huella del respaldo no coincide');
  const datos = JSON.parse(zlib.gunzipSync(bytes));
  const c = await pool.connect();
  try {
    const base = (await c.query('SELECT current_database() AS nombre')).rows[0]
      .nombre;
    if (base !== datos.base)
      throw new Error('El respaldo pertenece a otra base');
    const lista = datos.tablas.map((t) => {
      if (!['public', 'bi', 'dw', 'etl'].includes(t.schemaname))
        throw new Error('Esquema no permitido');
      return {
        ...t,
        nombre: `${t.schemaname}.${t.tablename}`,
        sql: seguro(t.schemaname) + '.' + seguro(t.tablename),
      };
    });
    const referencias = (
      await c.query(
        "SELECT ns.nspname||'.'||cl.relname AS hijo,np.nspname||'.'||cp.relname AS padre FROM pg_constraint co JOIN pg_class cl ON cl.oid=co.conrelid JOIN pg_namespace ns ON ns.oid=cl.relnamespace JOIN pg_class cp ON cp.oid=co.confrelid JOIN pg_namespace np ON np.oid=cp.relnamespace WHERE co.contype='f' AND ns.nspname IN ('public','bi','dw','etl')"
      )
    ).rows;
    const orden = [],
      pendientes = [...lista],
      nombres = new Set(lista.map((t) => t.nombre));
    while (pendientes.length) {
      const i = pendientes.findIndex((t) =>
        referencias
          .filter(
            (r) =>
              r.hijo === t.nombre &&
              r.padre !== t.nombre &&
              nombres.has(r.padre)
          )
          .every((r) => orden.some((p) => p.nombre === r.padre))
      );
      if (i < 0)
        throw new Error(
          'Hay dependencias cíclicas que requieren restauración especializada'
        );
      orden.push(pendientes.splice(i, 1)[0]);
    }
    if (!process.argv.includes('--aplicar')) {
      console.log(
        JSON.stringify({
          respaldoVerificado: true,
          base,
          tablas: lista.length,
          filas: lista.reduce((n, t) => n + t.filas.length, 0),
          ordenRestauracionValidado: true,
        })
      );
      return;
    }
    await c.query('BEGIN');
    await c.query(
      'TRUNCATE TABLE ' +
        lista.map((t) => t.sql).join(',') +
        ' RESTART IDENTITY'
    );
    for (const t of orden) {
      if (!t.filas.length) continue;
      const columnas = Object.keys(t.filas[0]);
      // Una sentencia por tabla mantiene las referencias de filas a su propia tabla.
      const valores = [],
        filas = t.filas.map(
          (f) =>
            '(' +
            columnas
              .map((k) => {
                let v = f[k];
                if (v?.type === 'Buffer' && Array.isArray(v.data))
                  v = Buffer.from(v.data);
                else if (v !== null && typeof v === 'object')
                  v = JSON.stringify(v);
                valores.push(v);
                return '$' + valores.length;
              })
              .join(',') +
            ')'
        );
      if (valores.length > 65000)
        throw new Error(
          'El respaldo requiere restauración por lotes especializada'
        );
      await c.query(
        `INSERT INTO ${t.sql}(${columnas.map(seguro).join(',')}) VALUES ${filas.join(',')}`,
        valores
      );
    }
    for (const s of datos.secuencias)
      await c.query(
        `ALTER SEQUENCE ${seguro(s.sequence_schema)}.${seguro(s.sequence_name)} RESTART WITH ${Number(s.last_value) + (s.is_called ? 1 : 0)}`
      );
    await c.query('COMMIT');
    console.log('Respaldo restaurado y secuencias recuperadas');
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

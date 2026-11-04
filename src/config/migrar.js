'use strict';
const fs = require('fs');
const path = require('path');
const pool = require('./db');
module.exports = async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock(741092)');
    await c.query(
      'CREATE TABLE IF NOT EXISTS migraciones_aplicadas(nombre TEXT PRIMARY KEY,aplicado_en TIMESTAMPTZ DEFAULT NOW())'
    );
    const folder = path.join(__dirname, '../../database/migrations');
    for (const name of fs
      .readdirSync(folder)
      .filter((n) => n.endsWith('.sql'))
      .sort()) {
      if (
        (
          await c.query('SELECT 1 FROM migraciones_aplicadas WHERE nombre=$1', [
            name,
          ])
        ).rowCount
      )
        continue;
      await c.query(fs.readFileSync(path.join(folder, name), 'utf8'));
      await c.query('INSERT INTO migraciones_aplicadas(nombre) VALUES($1)', [
        name,
      ]);
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
};

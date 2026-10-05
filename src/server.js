'use strict';

const app = require('./app');
const env = require('./config/env');
const pool = require('./config/db');

const iniciar = async () => {
  await pool.query('SELECT 1');
  await pool.query('ALTER TABLE turnos ADD COLUMN IF NOT EXISTS evidencias JSONB NOT NULL DEFAULT \'[]\'::jsonb');
  app.listen(env.PORT, () => {
    process.stdout.write(`Segur Track API escuchando en puerto ${env.PORT}\n`);
  });
};

iniciar().catch((err) => {
  process.stderr.write(`Error al iniciar el servidor: ${err.message}\n`);
  process.exit(1);
});

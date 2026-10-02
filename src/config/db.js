'use strict';

const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  host:     env.DB_HOST,
  port:     env.DB_PORT,
  database: env.DB_NAME,
  user:     env.DB_USER,
  password: env.DB_PASSWORD,
  ssl:      env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false,
  max:      10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  keepAlive: true,
});

pool.on('error', (err) => {
  // Manejo de error de cliente inactivo para evitar caídas
});

module.exports = pool;

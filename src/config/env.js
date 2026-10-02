'use strict';

require('dotenv').config();

const env = {
  NODE_ENV:               process.env.NODE_ENV || 'development',
  PORT:                   parseInt(process.env.PORT, 10) || 3001,
  DB_HOST:                process.env.DB_HOST || 'localhost',
  DB_PORT:                parseInt(process.env.DB_PORT, 10) || 5432,
  DB_NAME:                process.env.DB_NAME || 'segur_track',
  DB_USER:                process.env.DB_USER || 'postgres',
  DB_PASSWORD:            process.env.DB_PASSWORD || '',
  JWT_SECRET:             process.env.JWT_SECRET,
  JWT_EXPIRATION:         process.env.JWT_EXPIRATION || '8h',
  CORS_ORIGIN:            process.env.CORS_ORIGIN || 'http://localhost:5173',
  POWER_BI_EMBED_URL:     process.env.POWER_BI_EMBED_URL || '',
};

if (!env.JWT_SECRET) {
  throw new Error('JWT_SECRET no está definido en las variables de entorno');
}

module.exports = env;

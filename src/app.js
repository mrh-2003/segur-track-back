'use strict';

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const swaggerUi       = require('swagger-ui-express');
const swaggerDocument = require('./docs/swagger');
const env             = require('./config/env');

const rutas         = require('./routes');
const { manejarErrores, noEncontrado } = require('./middlewares/errores');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocument);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get('/docs', (req, res) => res.redirect('/api/docs'));

app.use('/api/v1', rutas);

app.use(noEncontrado);
app.use(manejarErrores);

module.exports = app;

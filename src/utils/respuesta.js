'use strict';

const respuestaExito = (res, datos, meta = {}, codigo = 200) => {
  res.status(codigo).json({ ok: true, datos, meta });
};

const respuestaCreado = (res, datos) => {
  res.status(201).json({ ok: true, datos, meta: {} });
};

module.exports = { respuestaExito, respuestaCreado };

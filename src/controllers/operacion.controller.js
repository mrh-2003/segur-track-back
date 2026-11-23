'use strict';
const svc = require('../services/operacion.service');
const repo = require('../repositories/operacion.repository');
const { respuestaExito } = require('../utils/respuesta');
const handler = (fn) => async (req, res, next) => {
  try {
    respuestaExito(res, await fn(req));
  } catch (e) {
    next(e);
  }
};
exports.catalogos = handler(r => repo.catalogos(r.usuario));
exports.opcionesTurno = handler((r) => svc.opcionesTurno(r.query, r.usuario));
exports.disponibles = handler((r) =>
  svc.personalDisponible(r.query.inicio, r.query.fin, r.usuario)
);
exports.historial = handler((r) =>
  svc.historial(Number(r.params.id), r.usuario)
);
exports.asistencia = handler((r) =>
  svc.asistencia(Number(r.params.id), r.body, r.usuario)
);
exports.ausencias = handler(() => repo.ausencias());
exports.crearAusencia = handler((r) => svc.crearAusencia(r.body, r.usuario));
exports.eliminarAusencia = handler((r) => repo.eliminarAusencia(r.params.id));
exports.responsables = handler(() => repo.responsables());
exports.turnosServicio = handler((r) =>
  repo.turnosServicio(r.params.id, r.usuario)
);

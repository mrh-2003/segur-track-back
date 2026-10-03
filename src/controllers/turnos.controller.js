'use strict';

const turnosService = require('../services/turnos.service');
const { respuestaExito, respuestaCreado } = require('../utils/respuesta');

const listarSemana = async (req, res, next) => {
  try {
    const desde = req.query.desde || new Date().toISOString().slice(0, 10);
    const hasta = req.query.hasta || new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10);
    const sedeId = req.query.sedeId ? parseInt(req.query.sedeId, 10) : null;
    respuestaExito(res, await turnosService.listarPorSemana({ desde, hasta, sedeId }));
  } catch (err) { next(err); }
};

const resumen = async (req, res, next) => {
  try {
    respuestaExito(res, await turnosService.obtenerResumen());
  } catch (err) { next(err); }
};

const alertas = async (req, res, next) => {
  try {
    respuestaExito(res, await turnosService.obtenerAlertas());
  } catch (err) { next(err); }
};

const crear = async (req, res, next) => {
  try {
    respuestaCreado(res, await turnosService.crear(req.body, req.usuario));
  } catch (err) { next(err); }
};

const actualizar = async (req, res, next) => {
  try {
    respuestaExito(res, await turnosService.actualizar(parseInt(req.params.id, 10), req.body, req.usuario));
  } catch (err) { next(err); }
};

const confirmar = async (req, res, next) => {
  try {
    respuestaExito(res, await turnosService.confirmar(parseInt(req.params.id, 10), req.usuario));
  } catch (err) { next(err); }
};

const rechazar = async (req, res, next) => {
  try {
    respuestaExito(res, await turnosService.rechazar(parseInt(req.params.id, 10), req.body?.motivo, req.usuario));
  } catch (err) { next(err); }
};

const reasignar = async (req, res, next) => {
  try {
    respuestaExito(res, await turnosService.reasignar(parseInt(req.params.id, 10), req.body, req.usuario));
  } catch (err) { next(err); }
};

const eliminar = async (req, res, next) => {
  try {
    await turnosService.eliminar(parseInt(req.params.id, 10), req.usuario.id);
    respuestaExito(res, { mensaje: 'Turno eliminado' });
  } catch (err) { next(err); }
};

const listarSedes = async (req, res, next) => {
  try {
    respuestaExito(res, await turnosService.listarSedes());
  } catch (err) { next(err); }
};

module.exports = {
  listarSemana,
  resumen,
  alertas,
  crear,
  actualizar,
  confirmar,
  rechazar,
  reasignar,
  eliminar,
  listarSedes,
};

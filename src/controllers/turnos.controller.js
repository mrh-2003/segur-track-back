'use strict';

const turnosService = require('../services/turnos.service');
const { respuestaExito, respuestaCreado } = require('../utils/respuesta');

const listarSemana = async (req, res, next) => {
  try {
    const desde =
      req.query.desde ||
      require('../services/evaluacion-operativa').fechaLocal(new Date());
    const hasta =
      req.query.hasta ||
      require('../services/evaluacion-operativa').fechaLocal(
        new Date(Date.now() + 6 * 864e5)
      );
    const valida = (v) => {
      const d = new Date(v + 'T00:00:00Z');
      return (
        /^\d{4}-\d{2}-\d{2}$/.test(v) &&
        Number.isFinite(+d) &&
        d.toISOString().slice(0, 10) === v
      );
    };
    if (!valida(desde) || !valida(hasta) || hasta < desde)
      throw new (require('../utils/errores').ErrorValidacion)(
        'Intervalo de fechas inválido'
      );
    const sedeId = req.query.sedeId ? parseInt(req.query.sedeId, 10) : null;
    respuestaExito(
      res,
      await turnosService.listarPorSemana({ desde, hasta, sedeId })
    );
  } catch (err) {
    next(err);
  }
};

const resumen = async (req, res, next) => {
  try {
    respuestaExito(res, await turnosService.obtenerResumen());
  } catch (err) {
    next(err);
  }
};

const alertas = async (req, res, next) => {
  try {
    respuestaExito(res, await turnosService.obtenerAlertas());
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    respuestaCreado(
      res,
      await require('../services/operacion.service').crearTurno(
        req.body,
        req.usuario
      )
    );
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    respuestaExito(
      res,
      await require('../services/operacion.service').actualizarTurno(
        parseInt(req.params.id, 10),
        req.body,
        req.usuario
      )
    );
  } catch (err) {
    next(err);
  }
};

const confirmar = async (req, res, next) => {
  try {
    respuestaExito(
      res,
      await require('../services/operacion.service').cambiarTurno(
        parseInt(req.params.id, 10),
        'confirmar',
        {},
        req.usuario
      )
    );
  } catch (err) {
    next(err);
  }
};

const cumplir = async (req, res, next) => {
  try {
    respuestaExito(
      res,
      await require('../services/operacion.service').cambiarTurno(
        parseInt(req.params.id, 10),
        'cumplir',
        req.body,
        req.usuario
      )
    );
  } catch (err) {
    next(err);
  }
};

const obtenerImagekitAuth = async (req, res, next) => {
  try {
    respuestaExito(res, turnosService.obtenerImagekitAuth());
  } catch (err) {
    next(err);
  }
};

const rechazar = async (req, res, next) => {
  try {
    respuestaExito(
      res,
      await require('../services/operacion.service').cambiarTurno(
        parseInt(req.params.id, 10),
        'rechazar',
        req.body,
        req.usuario
      )
    );
  } catch (err) {
    next(err);
  }
};

const reasignar = async (req, res, next) => {
  try {
    respuestaExito(
      res,
      await require('../services/operacion.service').reasignar(
        parseInt(req.params.id, 10),
        req.body,
        req.usuario
      )
    );
  } catch (err) {
    next(err);
  }
};

const eliminar = async (req, res, next) => {
  try {
    await require('../services/operacion.service').cambiarTurno(
      parseInt(req.params.id, 10),
      'eliminar',
      {},
      req.usuario
    );
    respuestaExito(res, { mensaje: 'Turno eliminado' });
  } catch (err) {
    next(err);
  }
};

const listarSedes = async (req, res, next) => {
  try {
    respuestaExito(res, await turnosService.listarSedes());
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listarSemana,
  resumen,
  alertas,
  crear,
  actualizar,
  confirmar,
  cumplir,
  obtenerImagekitAuth,
  rechazar,
  reasignar,
  eliminar,
  listarSedes,
};

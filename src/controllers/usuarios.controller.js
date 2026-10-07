'use strict';

const usuariosService = require('../services/usuarios.service');
const { respuestaExito } = require('../utils/respuesta');

const listar = async (req, res, next) => {
  try {
    const { pagina, limite, q, rol, activo } = req.query;
    const resultado = await usuariosService.listar({ pagina, limite, q, rol, activo });
    respuestaExito(res, resultado.datos, resultado.meta);
  } catch (err) {
    next(err);
  }
};

const obtener = async (req, res, next) => {
  try {
    const u = await usuariosService.obtener(parseInt(req.params.id, 10));
    respuestaExito(res, u);
  } catch (err) {
    next(err);
  }
};

const resumen = async (req, res, next) => {
  try {
    const data = await usuariosService.resumen();
    respuestaExito(res, data);
  } catch (err) {
    next(err);
  }
};

const cambiarRol = async (req, res, next) => {
  try {
    const u = await usuariosService.cambiarRol(parseInt(req.params.id, 10), req.body.rol, req.usuario);
    respuestaExito(res, u);
  } catch (err) {
    next(err);
  }
};

const cambiarEstado = async (req, res, next) => {
  try {
    const activo = req.body.activo === true || req.body.activo === 'true';
    const u = await usuariosService.cambiarEstado(parseInt(req.params.id, 10), activo, req.usuario);
    respuestaExito(res, u);
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    const nuevo = await usuariosService.crear(req.body, req.usuario);
    respuestaExito(res, nuevo, null, 201);
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, obtener, resumen, crear, cambiarRol, cambiarEstado };

'use strict';

const authService = require('../services/auth.service');
const { respuestaExito } = require('../utils/respuesta');

const login = async (req, res, next) => {
  try {
    const resultado = await authService.login(req.body);
    respuestaExito(res, resultado);
  } catch (err) {
    next(err);
  }
};

const perfil = async (req, res, next) => {
  try {
    const usuario = await authService.obtenerPerfil(req.usuario.id);
    respuestaExito(res, usuario);
  } catch (err) {
    next(err);
  }
};

const actualizarPerfil = async (req, res, next) => {
  try {
    const actualizado = await authService.actualizarPerfil(req.usuario.id, req.body);
    respuestaExito(res, actualizado);
  } catch (err) {
    next(err);
  }
};

const cambiarClave = async (req, res, next) => {
  try {
    const resultado = await authService.cambiarClave(req.usuario.id, req.body);
    respuestaExito(res, resultado);
  } catch (err) {
    next(err);
  }
};

const solicitarRecuperacion = async (req, res, next) => {
  try {
    const resultado = await authService.solicitarRecuperacion(req.body);
    respuestaExito(res, resultado);
  } catch (err) {
    next(err);
  }
};

const restablecerClave = async (req, res, next) => {
  try {
    const resultado = await authService.restablecerClave(req.body);
    respuestaExito(res, resultado);
  } catch (err) {
    next(err);
  }
};

const logout = (req, res) => {
  respuestaExito(res, { mensaje: 'Sesión cerrada correctamente' });
};

module.exports = {
  login,
  perfil,
  actualizarPerfil,
  cambiarClave,
  solicitarRecuperacion,
  restablecerClave,
  logout,
};

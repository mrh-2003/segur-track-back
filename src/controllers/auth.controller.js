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

const logout = (req, res) => {
  respuestaExito(res, { mensaje: 'Sesión cerrada' });
};

module.exports = { login, perfil, logout };

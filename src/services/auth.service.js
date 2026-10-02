'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const authRepo = require('../repositories/auth.repository');
const { ErrorAutenticacion } = require('../utils/errores');

const login = async ({ correo, clave }) => {
  const usuario = await authRepo.buscarPorCorreo(correo);
  if (!usuario || !usuario.activo) {
    throw new ErrorAutenticacion('Credenciales incorrectas');
  }
  const claveValida = await bcrypt.compare(clave, usuario.clave_hash);
  if (!claveValida) {
    throw new ErrorAutenticacion('Credenciales incorrectas');
  }
  const payload = { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol };
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRATION });
  return {
    token,
    usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
  };
};

const obtenerPerfil = async (id) => {
  const usuario = await authRepo.buscarPorId(id);
  if (!usuario) throw new ErrorAutenticacion();
  return usuario;
};

module.exports = { login, obtenerPerfil };

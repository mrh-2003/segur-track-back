'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const authRepo = require('../repositories/auth.repository');
const { ErrorAutenticacion, ErrorValidacion } = require('../utils/errores');

const login = async ({ correo, clave }) => {
  const usuario = await authRepo.buscarPorCorreo(correo);
  if (!usuario || !usuario.activo) {
    throw new ErrorAutenticacion('Credenciales incorrectas o usuario inactivo');
  }

  const claveValida = await bcrypt.compare(clave, usuario.clave_hash);
  if (!claveValida) {
    throw new ErrorAutenticacion('Credenciales incorrectas');
  }

  const debeCambiarClave = Boolean(usuario.debe_cambiar_clave) || clave === usuario.correo;

  const payload = {
    id: usuario.id,
    nombre: usuario.nombre,
    rol: usuario.rol,
    personalId: usuario.personal_id || null,
  };
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRATION });

  return {
    token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      nombres: usuario.nombres || usuario.nombre.split(' ')[0],
      apellidos: usuario.apellidos || usuario.nombre.split(' ').slice(1).join(' '),
      correo: usuario.correo,
      rol: usuario.rol,
      personalId: usuario.personal_id || null,
      debeCambiarClave,
    },
  };
};

const obtenerPerfil = async (id) => {
  const usuario = await authRepo.buscarPorId(id);
  if (!usuario) throw new ErrorAutenticacion('Sesión expirada o usuario no encontrado');
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    nombres: usuario.nombres || usuario.nombre.split(' ')[0],
    apellidos: usuario.apellidos || usuario.nombre.split(' ').slice(1).join(' '),
    correo: usuario.correo,
    rol: usuario.rol,
    personalId: usuario.personal_id || null,
    documento: usuario.documento || null,
    cargo: usuario.cargo || null,
    debeCambiarClave: Boolean(usuario.debe_cambiar_clave),
  };
};

const actualizarPerfil = async (id, { nombres, apellidos }) => {
  const nombreCompleto = `${nombres.trim()} ${apellidos.trim()}`;
  const usuario = await authRepo.actualizarPerfil(id, {
    nombre: nombreCompleto,
    nombres: nombres.trim(),
    apellidos: apellidos.trim(),
  });
  return {
    ...usuario,
    nombres: nombres.trim(),
    apellidos: apellidos.trim(),
  };
};

const cambiarClave = async (id, { claveActual, nuevaClave }) => {
  const usuario = await authRepo.buscarPorId(id);
  if (!usuario) throw new ErrorAutenticacion();

  const usuarioCompleto = await authRepo.buscarPorCorreo(usuario.correo);
  const actualValida = await bcrypt.compare(claveActual, usuarioCompleto.clave_hash);
  if (!actualValida) {
    throw new ErrorValidacion('La contraseña actual no es correcta', [
      { campo: 'claveActual', mensaje: 'Contraseña actual incorrecta' },
    ]);
  }

  if (nuevaClave.toLowerCase() === usuario.correo.toLowerCase()) {
    throw new ErrorValidacion('La nueva contraseña no puede ser igual a su correo de usuario', [
      { campo: 'nuevaClave', mensaje: 'No puede ser igual a su correo' },
    ]);
  }

  const hash = await bcrypt.hash(nuevaClave, 10);
  await authRepo.actualizarClave(id, hash);
  return { mensaje: 'Contraseña actualizada correctamente' };
};

const solicitarRecuperacion = async ({ correo }) => {
  const usuario = await authRepo.buscarPorCorreo(correo);
  if (!usuario || !usuario.activo) {
    throw new ErrorValidacion('No se encontró una cuenta activa con el correo ingresado', [
      { campo: 'correo', mensaje: 'Correo no registrado' },
    ]);
  }

  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const expira = new Date(Date.now() + 15 * 60 * 1000);

  await authRepo.guardarCodigoRecuperacion(correo, codigo, expira);

  return {
    mensaje: `Se ha generado el código de verificación: ${codigo}. Ingréselo junto a su nueva contraseña.`,
    codigo,
  };
};

const restablecerClave = async ({ correo, codigo, nuevaClave }) => {
  const usuario = await authRepo.buscarPorCorreo(correo);
  if (!usuario || !usuario.activo) {
    throw new ErrorValidacion('Usuario no encontrado', [
      { campo: 'correo', mensaje: 'Usuario inválido' },
    ]);
  }

  if (!usuario.codigo_recuperacion || usuario.codigo_recuperacion !== codigo.trim()) {
    throw new ErrorValidacion('El código de recuperación es incorrecto', [
      { campo: 'codigo', mensaje: 'Código incorrecto' },
    ]);
  }

  if (usuario.recuperacion_expira && new Date() > new Date(usuario.recuperacion_expira)) {
    throw new ErrorValidacion('El código de recuperación ha expirado. Solicite uno nuevo.', [
      { campo: 'codigo', mensaje: 'Código expirado' },
    ]);
  }

  if (nuevaClave.toLowerCase() === correo.toLowerCase()) {
    throw new ErrorValidacion('La nueva contraseña no puede ser igual a su correo de usuario', [
      { campo: 'nuevaClave', mensaje: 'No puede ser igual a su correo' },
    ]);
  }

  const hash = await bcrypt.hash(nuevaClave, 10);
  await authRepo.restablecerClaveConCodigo(correo, hash);
  return { mensaje: 'Su contraseña ha sido restablecida exitosamente. Ya puede iniciar sesión.' };
};

module.exports = {
  login,
  obtenerPerfil,
  actualizarPerfil,
  cambiarClave,
  solicitarRecuperacion,
  restablecerClave,
};

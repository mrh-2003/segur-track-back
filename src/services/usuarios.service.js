'use strict';

const bcrypt = require('bcryptjs');
const usuariosRepo = require('../repositories/usuarios.repository');
const actividadRepo = require('../repositories/actividad.repository');
const { ErrorNoEncontrado, ErrorAutorizacion, ErrorConflicto } = require('../utils/errores');
const { paginar } = require('../utils/paginacion');

const listar = async ({ pagina, limite, q, rol, activo }) => {
  const { offset, paginaActual, limiteParsed } = paginar(pagina, limite);
  const { filas, total } = await usuariosRepo.listar({ limite: limiteParsed, offset, q, rol, activo });
  return {
    datos: filas,
    meta: { total, pagina: paginaActual, limite: limiteParsed, paginas: Math.ceil(total / limiteParsed) },
  };
};

const obtener = async (id) => {
  const u = await usuariosRepo.obtenerPorId(id);
  if (!u) throw new ErrorNoEncontrado('Usuario no encontrado');
  return u;
};

const resumen = async () => usuariosRepo.obtenerResumen();

const crear = async ({ nombre, correo, clave, rol }, usuarioSolicitante) => {
  const existe = await usuariosRepo.buscarPorCorreo(correo);
  if (existe) {
    throw new ErrorConflicto('Ya existe un usuario con este correo electrónico');
  }
  const claveHash = await bcrypt.hash(clave || 'SegurTrack2026!', 10);
  const nuevo = await usuariosRepo.crear({
    nombre,
    correo,
    claveHash,
    rol: rol || 'operador',
    activo: true,
  });
  await actividadRepo.registrar({
    tipo: 'usuario_creado',
    descripcion: `Usuario "${nuevo.nombre}" (${nuevo.rol}) creado`,
    usuarioId: usuarioSolicitante.id,
  });
  return nuevo;
};

const cambiarRol = async (id, rol, usuarioSolicitante) => {
  if (usuarioSolicitante.id === id) {
    throw new ErrorAutorizacion('No puede cambiar su propio rol');
  }
  const u = await usuariosRepo.cambiarRol(id, rol);
  if (!u) throw new ErrorNoEncontrado('Usuario no encontrado');
  return u;
};

const cambiarEstado = async (id, activo, usuarioSolicitante) => {
  if (usuarioSolicitante.id === id) {
    throw new ErrorAutorizacion('No puede desactivar su propia cuenta');
  }
  const u = await usuariosRepo.cambiarEstado(id, activo);
  if (!u) throw new ErrorNoEncontrado('Usuario no encontrado');
  return u;
};

module.exports = { listar, obtener, resumen, crear, cambiarRol, cambiarEstado };

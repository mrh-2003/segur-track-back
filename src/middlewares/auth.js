'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const pool = require('../config/db');
const { ErrorAutenticacion, ErrorAutorizacion } = require('../utils/errores');

const autenticar = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ErrorAutenticacion());
  }
  const token = authHeader.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return next(new ErrorAutenticacion('Token inválido o expirado'));
  }
  try {
    const actual=(await pool.query(`SELECT u.id,u.nombre,u.rol,p.id personal_id FROM usuarios u
      LEFT JOIN personal p ON p.usuario_id=u.id AND NOT p.eliminado
      WHERE u.id=$1 AND u.activo AND NOT u.eliminado`,[payload.id])).rows[0];
    if(!actual)return next(new ErrorAutenticacion('La cuenta está inactiva o ya no existe'));
    req.usuario={...payload,id:actual.id,nombre:actual.nombre,rol:actual.rol,personalId:actual.personal_id||null};
    return next();
  }catch(err){return next(err);}
};

const autorizar = (...roles) => (req, res, next) => {
  if (!req.usuario || (req.usuario.rol !== 'administrador' && !roles.includes(req.usuario.rol))) {
    return next(new ErrorAutorizacion());
  }
  next();
};

module.exports = { autenticar, autorizar };

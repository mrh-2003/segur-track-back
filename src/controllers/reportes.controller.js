'use strict';

const reportesRepo = require('../repositories/reportes.repository');
const { respuestaExito, respuestaCreado } = require('../utils/respuesta');
const { ErrorNoEncontrado } = require('../utils/errores');
const { z } = require('zod');
const { validar } = require('../middlewares/validar');

const esquemaGenerar = z.object({
  tipo:     z.enum(['servicios','turnos','incidencias','bi','multicriterio']),
  categoria: z.enum(['operativos','incidencias','multicriterio']),
  formato:  z.enum(['xlsx','pdf']),
});

const listar = async (req, res, next) => {
  try {
    respuestaExito(res, await reportesRepo.listar());
  } catch (err) { next(err); }
};

const historial = async (req, res, next) => {
  try {
    respuestaExito(res, await reportesRepo.historial());
  } catch (err) { next(err); }
};

const generar = async (req, res, next) => {
  try {
    const reporte = await reportesRepo.crear({ ...req.body, generadoPor: req.usuario.id });
    respuestaCreado(res, reporte);
  } catch (err) { next(err); }
};

const descargar = async (req, res, next) => {
  try {
    const reporte = await reportesRepo.obtenerPorId(parseInt(req.params.id, 10));
    if (!reporte) throw new ErrorNoEncontrado('Reporte no encontrado');
    respuestaExito(res, { mensaje: 'Descarga simulada', reporte });
  } catch (err) { next(err); }
};

module.exports = { listar, historial, generar, descargar, esquemaGenerar };

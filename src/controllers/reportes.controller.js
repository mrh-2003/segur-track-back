'use strict';

const reportesRepo = require('../repositories/reportes.repository');
const { respuestaExito, respuestaCreado } = require('../utils/respuesta');
const { ErrorNoEncontrado } = require('../utils/errores');
const { z } = require('zod');
const { generarXlsx, generarPdf, obtenerDatosReporte } = require('../utils/exportador');

const esquemaGenerar = z.object({
  tipo: z.enum(['servicios', 'turnos', 'incidencias', 'bi', 'multicriterio']),
  categoria: z.enum(['operativos', 'incidencias', 'multicriterio']),
  formato: z.enum(['xlsx', 'pdf']),
});

const listar = async (req, res, next) => {
  try {
    respuestaExito(res, await reportesRepo.listar());
  } catch (err) {
    next(err);
  }
};

const historial = async (req, res, next) => {
  try {
    respuestaExito(res, await reportesRepo.historial());
  } catch (err) {
    next(err);
  }
};

const generar = async (req, res, next) => {
  try {
    const reporte = await reportesRepo.crear({ ...req.body, generadoPor: req.usuario.id });
    respuestaCreado(res, reporte);
  } catch (err) {
    next(err);
  }
};

const generarTimestamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dia = pad(d.getDate());
  const mes = pad(d.getMonth() + 1);
  const anio = d.getFullYear();
  const hora = pad(d.getHours());
  const min = pad(d.getMinutes());
  const seg = pad(d.getSeconds());
  return `${dia}-${mes}-${anio}_${hora}-${min}-${seg}`;
};

const descargar = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const reporte = await reportesRepo.obtenerPorId(id);
    if (!reporte) throw new ErrorNoEncontrado('Reporte no encontrado');

    const formato = (reporte.formato || 'xlsx').toLowerCase();
    const tipo = reporte.tipo || 'servicios';
    const datos = await obtenerDatosReporte(tipo);

    const timestamp = generarTimestamp();
    const nombreArchivo = `reporte_${tipo}_${timestamp}.${formato}`;

    let buffer;
    if (formato === 'pdf') {
      buffer = generarPdf(datos.titulo, datos.columnas, datos.filas);
      res.setHeader('Content-Type', 'application/pdf');
    } else {
      buffer = generarXlsx(datos.titulo, datos.columnas, datos.filas);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    }

    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    return res.end(buffer);
  } catch (err) {
    next(err);
  }
};

const descargarDirecto = async (req, res, next) => {
  try {
    const tipo = req.query.tipo || 'incidencias';
    const formato = (req.query.formato || 'xlsx').toLowerCase();
    const datos = await obtenerDatosReporte(tipo);

    const timestamp = generarTimestamp();
    const nombreArchivo = `reporte_${tipo}_${timestamp}.${formato}`;

    let buffer;
    if (formato === 'pdf') {
      buffer = generarPdf(datos.titulo, datos.columnas, datos.filas);
      res.setHeader('Content-Type', 'application/pdf');
    } else {
      buffer = generarXlsx(datos.titulo, datos.columnas, datos.filas);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    }

    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    return res.end(buffer);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listar,
  historial,
  generar,
  descargar,
  descargarDirecto,
  esquemaGenerar,
};

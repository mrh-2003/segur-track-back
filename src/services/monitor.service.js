'use strict';

const monitorRepo = require('../repositories/monitor.repository');
const { ErrorNoEncontrado } = require('../utils/errores');

const listarMonitor = async (filtros) => monitorRepo.listarMonitor(filtros);

const detalleOperativo = async (id) => {
  const detalle = await monitorRepo.obtenerDetalleOperativo(id);
  if (!detalle) throw new ErrorNoEncontrado('Servicio no encontrado');
  return detalle;
};

const indicadoresOperativos = async (filtros) => monitorRepo.obtenerIndicadoresOperativos(filtros);

const historialIndicadores = async (filtros) => monitorRepo.obtenerHistorialIndicadores(filtros);

const indicadoresPorServicio = async (filtros) => monitorRepo.obtenerIndicadoresPorServicio(filtros);

module.exports = {
  listarMonitor,
  detalleOperativo,
  indicadoresOperativos,
  historialIndicadores,
  indicadoresPorServicio,
};

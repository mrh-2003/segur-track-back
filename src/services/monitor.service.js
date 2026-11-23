'use strict';

const monitorRepo = require('../repositories/monitor.repository');
const { ErrorNoEncontrado } = require('../utils/errores');

const listarMonitor = async (filtros,u) => monitorRepo.listarMonitor({...filtros,permitidos:await require('./acceso-servicios').serviciosPermitidos(u)});

const detalleOperativo = async (id,u) => {
  await require('./acceso-servicios').comprobar(id,u);
  const detalle = await monitorRepo.obtenerDetalleOperativo(id);
  if (!detalle) throw new ErrorNoEncontrado('Servicio no encontrado');
  return detalle;
};

const indicadoresOperativos = async (filtros,u) => monitorRepo.obtenerIndicadoresOperativos({...filtros,permitidos:await require('./acceso-servicios').serviciosPermitidos(u)});

const historialIndicadores = async (filtros,u) => monitorRepo.obtenerHistorialIndicadores({...filtros,permitidos:await require('./acceso-servicios').serviciosPermitidos(u)});

const indicadoresPorServicio = async (filtros,u) => monitorRepo.obtenerIndicadoresPorServicio({...filtros,permitidos:await require('./acceso-servicios').serviciosPermitidos(u)});

module.exports = {
  listarMonitor,
  detalleOperativo,
  indicadoresOperativos,
  historialIndicadores,
  indicadoresPorServicio,
};

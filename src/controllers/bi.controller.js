'use strict';

const biRepo = require('../repositories/bi.repository');
const env    = require('../config/env');
const { respuestaExito } = require('../utils/respuesta');

const indicadores = async (req, res, next) => {
  try {
    const datos = await biRepo.obtenerIndicadores({
      periodo:   req.query.periodo   || 30,
      clienteId: req.query.clienteId ? parseInt(req.query.clienteId, 10) : null,
      servicioId: req.query.servicioId ? parseInt(req.query.servicioId, 10) : null,
    },req.usuario);
    respuestaExito(res, datos);
  } catch (err) { next(err); }
};

const evolucionCumplimiento = async (req, res, next) => {
  try {
    respuestaExito(res, await biRepo.obtenerEvolucionCumplimiento(req.query,req.usuario));
  } catch (err) { next(err); }
};

const incidenciasPorTipo = async (req, res, next) => {
  try {
    respuestaExito(res, await biRepo.obtenerIncidenciasPorTipo(req.query,req.usuario));
  } catch (err) { next(err); }
};

const desempenoPorServicio = async (req, res, next) => {
  try {
    respuestaExito(res, await biRepo.obtenerDesempenoPorServicio(req.query,req.usuario));
  } catch (err) { next(err); }
};

const embed = (req, res) => {
  // Un enlace estático no transmite identidad/RLS del supervisor.
  respuestaExito(res, { url: req.usuario.rol==='supervisor' ? '' : env.POWER_BI_EMBED_URL });
};

module.exports = { indicadores, evolucionCumplimiento, incidenciasPorTipo, desempenoPorServicio, embed };

const dw=require('../repositories/warehouse.repository');
const etl=require('../services/warehouse.service');
const handler=fn=>async(req,res,next)=>{try{respuestaExito(res,await fn(req));}catch(e){next(e);}};
module.exports.resumen=handler(r=>dw.resumen(r.query,r.usuario));
module.exports.catalogos=handler(r=>dw.catalogos(r.usuario));
module.exports.estado=handler(async r=>{const s=await etl.estado();if(r.usuario.rol==='supervisor'&&s.ultima)delete s.ultima.detalle;return s;});
module.exports.sincronizar=handler(r=>etl.sincronizar({origen:'boton',usuarioId:r.usuario.id}));
module.exports.configuracion=handler(()=>require('../services/metas-bi.service').obtener());
module.exports.guardarMetas=handler(r=>require('../services/metas-bi.service').guardar(r.body,r.usuario));

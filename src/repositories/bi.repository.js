'use strict';
const dw=require('./warehouse.repository');
const valores=r=>Object.fromEntries(r.indicadores.map(i=>[i.codigo,i.valor]));
exports.obtenerIndicadores=async(q,u)=>{const v=valores(await dw.resumen(q,u));return {cumplimiento_turnos:v.I01,cumplimiento_servicios:null,incidencias_abiertas:v.I17,tiempo_promedio_atencion:v.I15};};
exports.obtenerEvolucionCumplimiento=async(q,u)=>(await dw.resumen(q,u)).evolucion.map(e=>({...e,semana:e.mes+'-01',turnos_pct:e.cobertura,servicios_pct:null}));
exports.obtenerIncidenciasPorTipo=async(q,u)=>(await dw.resumen(q,u)).tipos;
exports.obtenerDesempenoPorServicio=async(q,u)=>(await dw.resumen(q,u)).servicios.map(s=>({...s,cumplimiento_pct:s.cobertura,incidencias:null,tiempo_prom_atencion:null}));

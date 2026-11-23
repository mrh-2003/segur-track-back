'use strict';
const pool = require('../config/db');
const svc = require('./operacion.service');
const { ErrorValidacion, ErrorNoEncontrado } = require('../utils/errores');
const obtenerCriterios = async () =>
  (
    await pool.query(
      'SELECT codigo AS id,* FROM modelo_operativo ORDER BY codigo'
    )
  ).rows;
const actualizarPesos = async (criterios) => {
  if (
    criterios.length !== 5 ||
    new Set(criterios.map((c) => c.id)).size !== 5 ||
    criterios.some((c) => !/^C0[1-5]$/.test(c.id)) ||
    Math.abs(criterios.reduce((s, c) => s + c.peso, 0) - 1) > 0.000001
  )
    throw new ErrorValidacion(
      'Se requieren los cinco criterios con pesos que sumen 100 %'
    );
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const x of criterios)
      await c.query(
        'UPDATE modelo_operativo SET peso=$1,umbral=COALESCE($2,umbral) WHERE codigo=$3',
        [x.peso, x.umbral || null, x.id]
      );
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
};
const obtenerResultado = (q,u) => svc.resultado(q,u);
const obtenerIndicadores = (q,u) => svc.resultado(q,u);
const obtenerDetallePorServicio = async (id, q, u, personalId=null) => {
  await require('./acceso-servicios').comprobar(id,u);
  const data=await require('./acceso-servicios').filtrarFuentes(await require('../repositories/operacion.repository').fuentes(),u);
  const {evaluarFuentes,filtros,franja}=require('./evaluacion-operativa');
  const f=filtros(q,data.corte);
  const enPeriodo=fecha=>+new Date(fecha)>=+(f.inicio?new Date(f.inicio):-Infinity)&&+new Date(fecha)<=+new Date(f.fin);
  const turnos=data.turnos.filter(t=>t.servicio_id===id&&enPeriodo(t.inicio_programado)&&(f.turno==='ambos'||franja(t.inicio_programado)===f.turno));
  const personal=(await pool.query(`SELECT p.id,p.nombres||' '||p.apellidos nombre,p.estado,
    EXISTS(SELECT 1 FROM servicio_personal sp WHERE sp.personal_id=p.id AND sp.servicio_id=$1 AND NOT sp.eliminado) asignado_actual
    FROM personal p WHERE p.cargo='agente' AND NOT p.eliminado AND (
    EXISTS(SELECT 1 FROM servicio_personal sp WHERE sp.personal_id=p.id AND sp.servicio_id=$1 AND NOT sp.eliminado)
    OR p.id=ANY($2::int[]) OR p.id=ANY($3::int[])) ORDER BY p.apellidos,p.nombres`,[id,turnos.map(t=>t.personal_id).filter(Boolean),data.incidencias.filter(i=>i.servicio_id===id&&enPeriodo(i.fecha_registro)).map(i=>i.responsable_id).filter(Boolean)])).rows;
  if(u.rol==='operador'){const propios=(await pool.query('SELECT id FROM personal WHERE usuario_id=$1 AND NOT eliminado',[u.id])).rows.map(p=>p.id);for(let i=personal.length-1;i>=0;i--)if(!propios.includes(personal[i].id))personal.splice(i,1);}
  const agente=personalId?personal.find(p=>p.id===personalId):null;
  if(personalId&&!agente)throw new ErrorNoEncontrado('Agente no asignado a este servicio ni vinculado a su operación en el periodo');
  // Las obligaciones se filtran por los turnos del agente; las incidencias por su responsable.
  const fuentes=personalId?{...data,turnosReferencia:data.turnos,turnos:data.turnos.filter(t=>t.personal_id===personalId),incidencias:data.incidencias.filter(i=>i.responsable_id===personalId)}:data;
  const r = evaluarFuentes(fuentes,{ ...q, servicios: String(id) });
  if (!r.tabla.length) throw new ErrorNoEncontrado('Servicio no encontrado');
  const referencia=new Map(data.turnos.map(t=>[t.id,t]));
  const incidencias=fuentes.incidencias.filter(i=>i.servicio_id===id&&enPeriodo(i.fecha_registro)&&(f.turno==='ambos'||franja(referencia.get(i.turno_id)?.inicio_programado||i.fecha_registro)===f.turno));
  const agenteIds=new Set(personal.map(p=>p.id));
  return {
    ...r.tabla[0],
    filtros: r.filtros,
    version: r.version,
    criticas: r.criticas,
    agente,
    agentes:personal.map(p=>({...p,turnos:turnos.filter(t=>t.personal_id===p.id).length,incidencias:incidencias.filter(i=>i.responsable_id===p.id).length,resueltas:incidencias.filter(i=>i.responsable_id===p.id&&i.estado==='cerrada').length})),
    incidencias_resumen:{total:incidencias.length,resueltas:incidencias.filter(i=>i.estado==='cerrada').length,en_proceso:incidencias.filter(i=>i.estado==='en_atencion').length,por_atender:incidencias.filter(i=>i.estado==='abierta').length,sin_operador:incidencias.filter(i=>!agenteIds.has(i.responsable_id)).length},
    atribucion:personalId?'Turnos asignados a este agente y sus obligaciones; incidencias donde figura como responsable. No incluye las tareas de otros agentes.':null,
  };
};
const evaluar = (id, q, u) =>
  svc.guardarEvaluacion({ ...q, ...(id ? { servicios: String(id) } : {}) }, u);
module.exports = {
  obtenerCriterios,
  actualizarPesos,
  obtenerResultado,
  obtenerIndicadores,
  obtenerDetallePorServicio,
  evaluar,
};

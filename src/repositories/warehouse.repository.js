'use strict';
const pool=require('../config/db');
const acceso=require('../services/acceso-servicios');
const {ErrorValidacion}=require('../utils/errores');
const local=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d));
const mover=(s,n)=>{const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const filtro=`JOIN dw.dim_fecha d ON d.fecha_sk=f.fecha_sk
JOIN dw.dim_servicio ds ON ds.sk=f.servicio_sk JOIN dw.dim_cliente dc ON dc.sk=f.cliente_sk
JOIN dw.dim_sede de ON de.sk=f.sede_sk JOIN dw.dim_supervisor du ON du.sk=f.supervisor_sk
WHERE d.fecha BETWEEN $1::date AND $2::date AND ($3::int IS NULL OR dc.origen_id=$3)
AND ($4::int IS NULL OR ds.origen_id=$4) AND ($5::int IS NULL OR de.origen_id=$5)
AND ($6::int IS NULL OR du.origen_id=$6) AND ($7::int[] IS NULL OR ds.origen_id=ANY($7))`;
const tasa=(n,d)=>d?100*n/d:null;
async function ventana(args,c){
  const r=(await c.query(`WITH
    t AS(SELECT COALESCE(SUM(exigibles),0)::float exigibles,COALESCE(SUM(cubiertos),0)::float cubiertos,
      COALESCE(SUM(descubiertos),0)::float descubiertos,COALESCE(SUM(asignados_validados),0)::float asignados,
      COALESCE(SUM(ausentes),0)::float ausentes,COALESCE(SUM(asistencias),0)::float asistencias,
      COALESCE(SUM(tardanzas),0)::float tardanzas,COALESCE(SUM(validaciones_pendientes),0)::float pendientes
      FROM dw.fact_turno f ${filtro}),
    o AS(SELECT COALESCE(SUM(exigibles) FILTER(WHERE tipo_sk=1),0)::float actividades,
      COALESCE(SUM(completadas) FILTER(WHERE tipo_sk=1),0)::float ejecutadas,
      COALESCE(SUM(pendientes_vencidas) FILTER(WHERE tipo_sk=1),0)::float vencidas,
      COALESCE(SUM(exigibles) FILTER(WHERE tipo_sk=2),0)::float reportes,
      COALESCE(SUM(oportunas) FILTER(WHERE tipo_sk=2),0)::float oportunos,
      COALESCE(SUM(revisados) FILTER(WHERE tipo_sk=2),0)::float revisados,
      COALESCE(SUM(observados) FILTER(WHERE tipo_sk=2),0)::float observados FROM dw.fact_obligacion f ${filtro}),
    i AS(SELECT COUNT(*)::float incidencias,COALESCE(SUM(abiertas),0)::float abiertas,
      percentile_cont(.5) WITHIN GROUP(ORDER BY minutos_respuesta) FILTER(WHERE minutos_respuesta IS NOT NULL) mediana,
      COALESCE(SUM(resolucion_exigible),0)::float resoluciones,COALESCE(SUM(cerradas_en_plazo),0)::float cerradas,
      COALESCE(SUM(plazos_pendientes),0)::float plazos_pendientes FROM dw.fact_incidencia f ${filtro}),
    s AS(SELECT COUNT(*)::float activos FROM dw.fact_servicio_diario f ${filtro} AND d.fecha=$2::date)
    SELECT * FROM t CROSS JOIN o CROSS JOIN i CROSS JOIN s`,args)).rows[0];
  return {valores:{I00:r.activos,I01:tasa(r.cubiertos,r.exigibles),I02:r.descubiertos,I03:tasa(r.ausentes,r.asignados),I04:tasa(r.tardanzas,r.asistencias),I09:tasa(r.ejecutadas,r.actividades),I10:r.vencidas,I11:tasa(r.oportunos,r.reportes),I12:tasa(r.observados,r.revisados),I13:r.incidencias,I14:r.exigibles?1000*r.incidencias/r.exigibles:null,I15:r.mediana,I16:tasa(r.cerradas,r.resoluciones),I17:r.abiertas},calidad:{asistenciasPendientes:r.pendientes,plazosPendientes:r.plazos_pendientes},totales:r};
}
async function resumen(q={},u,c){
  const estado=(await c.query('SELECT * FROM etl.estado WHERE id=1')).rows[0];
  if(!estado.ultima_carga_en)return {sincronizado:false,indicadores:[],evolucion:[],servicios:[],tipos:[]};
  const corte=local(estado.ultima_carga_en);
  let inicio,fin=corte,anteriorInicio,anteriorFin;
  if(q.mes){
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(q.mes))throw new ErrorValidacion('Mes inválido');
    inicio=q.mes+'-01';const d=new Date(inicio+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);const ultimo=mover(d.toISOString().slice(0,10),-1);
    fin=ultimo<corte?ultimo:corte;
    const p=new Date(inicio+'T00:00:00Z');p.setUTCMonth(p.getUTCMonth()-1);anteriorInicio=p.toISOString().slice(0,10);
    anteriorFin=fin===ultimo?mover(inicio,-1):mover(anteriorInicio,Math.min(Number(fin.slice(-2)),Number(mover(inicio,-1).slice(-2)))-1);
  }else{
    const dias=Number(q.periodo||30);if(![7,30,90,180].includes(dias))throw new ErrorValidacion('Periodo inválido');
    inicio=mover(fin,-dias+1);anteriorFin=mover(inicio,-1);anteriorInicio=mover(anteriorFin,-dias+1);
  }
  const n=v=>{if(v==null||v==='')return null;const x=Number(v);if(!Number.isSafeInteger(x)||x<=0)throw new ErrorValidacion('Filtro inválido');return x;};
  const permitidos=await acceso.serviciosPermitidos(u,c);
  const args=[inicio,fin,n(q.clienteId),n(q.servicioId),n(q.sedeId),n(q.supervisorId),permitidos];
  const evolucionInicio=fin.slice(0,7)+'-01';const ed=new Date(evolucionInicio+'T00:00:00Z');ed.setUTCMonth(ed.getUTCMonth()-5);
  const [actual,anterior,defs,evol,serv,tipos]=await Promise.all([
    ventana(args,c),ventana([anteriorInicio,anteriorFin,...args.slice(2)],c),
    c.query(`SELECT i.*,m.valor meta FROM dw.dim_indicador i LEFT JOIN LATERAL
      (SELECT valor FROM dw.fact_meta WHERE indicador_sk=i.sk AND vigente_desde<=$1 AND (vigente_hasta IS NULL OR vigente_hasta>=$1) ORDER BY vigente_desde DESC LIMIT 1)m ON TRUE ORDER BY i.codigo`,[fin]),
    c.query(`SELECT to_char(d.fecha,'YYYY-MM') mes,100.0*SUM(cubiertos)/NULLIF(SUM(exigibles),0) cobertura,
      100.0*SUM(ausentes)/NULLIF(SUM(asignados_validados),0) ausentismo,100.0*SUM(tardanzas)/NULLIF(SUM(asistencias),0) tardanzas
      FROM dw.fact_turno f ${filtro} GROUP BY 1 ORDER BY 1`,[ed.toISOString().slice(0,10),fin,...args.slice(2)]),
    c.query(`SELECT ds.origen_id id,ds.nombre servicio,100.0*SUM(cubiertos)/NULLIF(SUM(exigibles),0) cobertura,
      SUM(exigibles)::int turnos,SUM(descubiertos)::int descubiertos FROM dw.fact_turno f ${filtro} GROUP BY 1,2 ORDER BY 2`,args),
    c.query(`SELECT ti.nombre tipo,COUNT(*)::int cantidad FROM dw.fact_incidencia f JOIN dw.dim_tipo_incidencia ti ON ti.sk=f.tipo_sk ${filtro} GROUP BY 1 ORDER BY 2 DESC`,args),
  ]);
  return {sincronizado:true,corte:estado.ultima_carga_en,periodo:{inicio,fin,anteriorInicio,anteriorFin},
    indicadores:defs.rows.map(i=>{const valor=actual.valores[i.codigo]??null,previo=anterior.valores[i.codigo]??null,meta=i.meta===null?null:Number(i.meta);return {...i,meta,valor,anterior:previo,variacion:valor!==null&&previo!==null?valor-previo:null,cumple:meta===null||valor===null?null:i.sentido==='menor'?valor<=meta:i.sentido==='mayor'?valor>=meta:null};}),
    evolucion:evol.rows,servicios:serv.rows,tipos:tipos.rows,calidad:actual.calidad,totales:actual.totales};
}
async function catalogos(u,c){
  const ids=await acceso.serviciosPermitidos(u,c);
  const servicios=(await c.query(`SELECT origen_id id,nombre,cliente_origen_id,sede_origen_id,supervisor_origen_id
    FROM dw.dim_servicio WHERE actual AND origen_id>0 AND NOT COALESCE((atributos->>'eliminado')::boolean,FALSE)
    AND ($1::int[] IS NULL OR origen_id=ANY($1)) ORDER BY nombre`,[ids])).rows;
  const select=async(tabla,campo)=>(await c.query(`SELECT origen_id id,nombre FROM dw.${tabla} WHERE actual AND origen_id=ANY($1::int[]) ORDER BY nombre`,[Array.from(new Set(servicios.map(s=>s[campo])))] )).rows;
  const [clientes,sedes,supervisores]=await Promise.all([select('dim_cliente','cliente_origen_id'),select('dim_sede','sede_origen_id'),select('dim_supervisor','supervisor_origen_id')]);
  return {servicios,clientes,sedes,supervisores};
}
// Un mismo corte y todos sus agregados pertenecen a una sola instantánea de lectura.
const consistente=async(fn)=>{
 const c=await pool.connect();
 // Encadenar consultas en un cliente evita consultas concurrentes en pg.
 let cola=Promise.resolve();const lector={query:(...a)=>{const r=cola.then(()=>c.query(...a));cola=r.catch(()=>{});return r;}};
 try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const r=await fn(lector);await c.query('COMMIT');return r;}
 catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
};
module.exports={resumen:(q={},u)=>consistente(c=>resumen(q,u,c)),catalogos:u=>consistente(c=>catalogos(u,c))};

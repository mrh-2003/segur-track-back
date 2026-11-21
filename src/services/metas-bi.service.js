'use strict';
const pool=require('../config/db');
const tx=require('../utils/transaccion');
const {ErrorValidacion}=require('../utils/errores');
exports.obtener=async()=>({indicadores:(await pool.query(`SELECT i.*,m.valor,m.vigente_desde,m.vigente_hasta
 FROM indicadores_bi i LEFT JOIN LATERAL(SELECT * FROM metas_bi WHERE codigo=i.codigo AND vigente_desde<=CURRENT_DATE
 AND (vigente_hasta IS NULL OR vigente_hasta>=CURRENT_DATE) ORDER BY vigente_desde DESC LIMIT 1)m ON TRUE ORDER BY i.codigo`)).rows});
exports.guardar=(d,u)=>tx(u.id,'Configuración de metas BI',async(c)=>{
  for(const m of d.metas){
    await c.query("SELECT pg_advisory_xact_lock(hashtext('meta-bi:'||$1))",[m.codigo]);
    const indicador=(await c.query('SELECT * FROM indicadores_bi WHERE codigo=$1',[m.codigo])).rows[0];
    if(!indicador)throw new ErrorValidacion('Indicador desconocido');
    if(indicador.unidad==='%'&&m.valor>100)throw new ErrorValidacion('Una meta porcentual debe estar entre 0 y 100');
    await c.query('UPDATE metas_bi SET vigente_hasta=$2::date-1 WHERE codigo=$1 AND vigente_desde<$2 AND (vigente_hasta IS NULL OR vigente_hasta>=$2)',[m.codigo,d.vigenteDesde]);
    await c.query(`INSERT INTO metas_bi(codigo,valor,vigente_desde,vigente_hasta,actualizado_por)
      SELECT $1,$2,$3,(SELECT MIN(vigente_desde)-1 FROM metas_bi WHERE codigo=$1 AND vigente_desde>$3),$4
      ON CONFLICT(codigo,vigente_desde) DO UPDATE SET valor=$2,actualizado_por=$4,actualizado_en=NOW()`,[m.codigo,m.valor,d.vigenteDesde,u.id]);
  }
  return {guardado:true,pendienteSincronizar:true};
});

'use strict';
const pool = require('../config/db');
const tx = require('../utils/transaccion');
const { comprobarAcceso } = require('./operacion.service');
const { ErrorValidacion, ErrorNoEncontrado, ErrorAutorizacion, ErrorConflicto } = require('../utils/errores');
const esGestor=(u)=>['administrador','jefe_operaciones','supervisor'].includes(u.rol);

exports.listar = async (id, u) => {
  const t=await comprobarAcceso(pool, id, u);
  const [turno, obligaciones, rondas, consignas, catalogo] = await Promise.all([
    pool.query('SELECT b.plan_kpi_validado,v.inicio_programado,v.fin_programado,NOW() AS corte FROM turnos b JOIN vw_operacion_turnos v ON v.id=b.id WHERE b.id=$1', [id]),
    pool.query('SELECT * FROM obligaciones_operativas WHERE turno_id=$1 AND NOT eliminado ORDER BY fecha_limite,id', [id]),
    pool.query('SELECT * FROM rondas WHERE turno_id=$1 AND NOT eliminado ORDER BY fecha_programada,id', [id]),
    pool.query('SELECT v.*,c.descripcion FROM verificaciones_consignas v JOIN consignas c ON c.id=v.consigna_id WHERE v.turno_id=$1 AND NOT c.eliminado ORDER BY v.id', [id]),
    pool.query('SELECT id,descripcion FROM consignas WHERE servicio_id=$1 AND activo AND NOT eliminado ORDER BY id',[t.servicio_id]),
  ]);
  const calendario=turno.rows[0];
  const futuro=+new Date(calendario.inicio_programado)>+new Date(calendario.corte);
  const ingresoValido=t.ingreso_real && +new Date(t.ingreso_real)<=+new Date(calendario.corte);
  return { ...calendario,puede_registrar:!futuro && (esGestor(u)||Boolean(ingresoValido)),
    motivo_bloqueo:futuro?'Este turno todavía no comienza. Puede consultar su programación; la ejecución estará disponible desde su inicio.':!esGestor(u)&&!ingresoValido?'Registre un ingreso válido antes de ejecutar las obligaciones.':null,
    obligaciones: obligaciones.rows, rondas: rondas.rows, consignas: consignas.rows,catalogoConsignas:catalogo.rows };
};

exports.registrar = (id, d, u) => tx(u.id, 'Registro de datos KPI: ' + d.tipo, async (c) => {
  const t = await comprobarAcceso(c, id, u);
  if(!esGestor(u) && (d.tipo!=='consigna' || !d.consignaId)) throw new ErrorAutorizacion('Solo supervisión puede programar obligaciones');
  if(d.tipo==='aplicar_plan') {
    if(!(await c.query('SELECT 1 FROM planes_operativos WHERE servicio_id=$1 AND confirmado',[t.servicio_id])).rowCount)
      throw new ErrorValidacion('Configure primero el plan operativo del servicio');
    await c.query('SELECT programar_plan_turno($1)',[id]);
    return {id,plan_kpi_validado:true};
  }
  if (d.tipo === 'validar_plan') {
    return (await c.query('UPDATE turnos SET plan_kpi_validado=TRUE,actualizado_en=NOW() WHERE id=$1 RETURNING id', [id])).rows[0];
  }
  if (d.tipo === 'consigna') {
    const calendario=(await c.query('SELECT inicio_programado,NOW() AS corte FROM vw_operacion_turnos WHERE id=$1',[id])).rows[0];
    if(+new Date(calendario.inicio_programado)>+new Date(calendario.corte)) throw new ErrorConflicto('El turno todavía no comienza; aún no puede verificar consignas.');
    if(!esGestor(u) && !t.ingreso_real) throw new ErrorConflicto('Registre el ingreso antes de verificar consignas');
    let consigna;
    if(d.consignaId) {
      consigna=(await c.query('SELECT id FROM consignas WHERE id=$1 AND servicio_id=$2 AND activo AND NOT eliminado',[d.consignaId,t.servicio_id])).rows[0];
      if(!consigna) throw new ErrorValidacion('Consigna no válida para el servicio');
      if((await c.query('SELECT 1 FROM verificaciones_consignas WHERE turno_id=$1 AND consigna_id=$2',[id,consigna.id])).rowCount)
        throw new ErrorConflicto('La consigna ya fue verificada en este turno');
    } else {
      if(!d.descripcion) throw new ErrorValidacion('Indique una consigna');
      consigna=(await c.query('INSERT INTO consignas(servicio_id,descripcion) VALUES($1,$2) RETURNING id',[t.servicio_id,d.descripcion])).rows[0];
    }
    return (await c.query('INSERT INTO verificaciones_consignas(turno_id,consigna_id,cumplida,observacion,verificado_por) VALUES($1,$2,$3,$4,$5) RETURNING *', [id, consigna.id, d.cumplida, d.observacion || null, u.id])).rows[0];
  }
  if (d.tipo === 'ronda') {
    return (await c.query('INSERT INTO rondas(turno_id,servicio_id,fecha_programada,ruta,creado_por) VALUES($1,$2,$3,$4,$5) RETURNING *', [id,t.servicio_id,d.fechaLimite,d.descripcion,u.id])).rows[0];
  }
  return (await c.query('INSERT INTO obligaciones_operativas(turno_id,tipo,descripcion,fecha_limite,creado_por) VALUES($1,$2,$3,$4,$5) RETURNING *', [id,d.tipo,d.descripcion,d.fechaLimite,u.id])).rows[0];
});

exports.actualizar = (turnoId, id, d, u) => tx(u.id, 'Seguimiento de obligación KPI', async (c) => {
  const t=await comprobarAcceso(c, turnoId, u);
  if(!esGestor(u) && (d.accion==='anular' || d.fechaCompletada)) throw new ErrorAutorizacion('Solo supervisión puede anular o corregir fechas');
  const tabla = d.tipo === 'ronda' ? 'rondas' : 'obligaciones_operativas';
  const item = (await c.query(`SELECT * FROM ${tabla} WHERE id=$1 AND turno_id=$2 AND NOT eliminado FOR UPDATE`, [id,turnoId])).rows[0];
  if (!item) throw new ErrorNoEncontrado('Obligación no encontrada');
  if (d.accion === 'anular') {
    return (await c.query(`UPDATE ${tabla} SET eliminado=TRUE,eliminado_por=$3,actualizado_en=NOW() WHERE id=$1 AND turno_id=$2 RETURNING *`, [id,turnoId,u.id])).rows[0];
  }
  if (item.fecha_completada) throw new ErrorConflicto('La obligación ya fue completada. Actualice el detalle para consultar su registro.');
  if(!esGestor(u) && !t.ingreso_real) throw new ErrorConflicto('Registre el ingreso antes de ejecutar el turno');
  const calendario=(await c.query('SELECT inicio_programado,NOW() AS corte FROM vw_operacion_turnos WHERE id=$1',[turnoId])).rows[0];
  if(+new Date(calendario.inicio_programado)>+new Date(calendario.corte))
    throw new ErrorConflicto('El turno todavía no comienza. Registre la ejecución a partir de su inicio programado.');
  if(!esGestor(u) && +new Date(t.ingreso_real)>+new Date(calendario.corte)) throw new ErrorConflicto('El ingreso registrado es futuro; solicite su corrección a supervisión.');
  if(item.tipo==='reporte' && (!d.resultado || d.resultado.trim().length<3)) throw new ErrorValidacion('Escriba el contenido del reporte operativo');
  const momento=d.fechaCompletada || calendario.corte;
  if(!Number.isFinite(+new Date(momento)) || +new Date(momento)>+new Date(calendario.corte) || +new Date(momento)<+new Date(calendario.inicio_programado))
    throw new ErrorValidacion('La finalización debe estar entre el inicio del turno y el momento actual');
  const evidencias=d.evidencias ?? (d.evidenciaUrl?[d.evidenciaUrl]:(item.evidencias||[]));
  return (await c.query(`UPDATE ${tabla} SET fecha_completada=$4,actualizado_en=NOW(),completado_por=$3,origen='ejecucion_usuario',evidencias=$6::jsonb,
    ${d.tipo === 'ronda' ? "estado='completada',observaciones=$5" : 'resultado=$5,evidencia_url=$7'}
    WHERE id=$1 AND turno_id=$2 RETURNING *`, [id,turnoId,u.id,momento,d.resultado || null,JSON.stringify(evidencias),...(d.tipo==='ronda'?[]:[evidencias[0]||null])])).rows[0];
});

'use strict';
const pool = require('../config/db');
const tx = require('../utils/transaccion');
const repo = require('../repositories/operacion.repository');
const { evaluarFuentes } = require('./evaluacion-operativa');
const { cubreHorario } = require('../utils/horario-personal');
const {
  ErrorValidacion,
  ErrorNoEncontrado,
  ErrorConflicto,
  ErrorAutorizacion,
} = require('../utils/errores');
const esGestor = (u) =>
  ['administrador', 'jefe_operaciones', 'supervisor'].includes(u.rol);
const comprobarAcceso = async (c, id, u) => {
  const t = (
    await c.query(
      `SELECT t.*,p.usuario_id FROM turnos t LEFT JOIN personal p ON p.id=t.personal_id WHERE t.id=$1 AND NOT t.eliminado FOR UPDATE OF t`,
      [id]
    )
  ).rows[0];
  if (!t) throw new ErrorNoEncontrado('Turno no encontrado');
  if (!esGestor(u) && t.usuario_id !== u.id && t.personal_id !== u.personalId)
    throw new ErrorAutorizacion();
  return t;
};
const disponible = async (c, personalId, inicio, fin, excluir) => {
  if (!personalId) return;
  await c.query('SELECT pg_advisory_xact_lock($1)', [personalId]);
  const p = (
    await c.query(
      "SELECT * FROM personal WHERE id=$1 AND NOT eliminado AND estado='activo'",
      [personalId]
    )
  ).rows[0];
  if (!p) throw new ErrorConflicto('El personal no está activo');
  if (!cubreHorario(p, inicio, fin))
    throw new ErrorConflicto('El turno está fuera del horario laboral del personal');
  const solapa = await c.query(
    `SELECT id FROM vw_operacion_turnos WHERE personal_id=$1 AND ($4::int IS NULL OR id<>$4) AND inicio_programado<$3 AND fin_programado>$2
    UNION ALL SELECT id::int FROM personal_ausencias WHERE personal_id=$1 AND NOT eliminado AND inicio<$3 AND fin>$2`,
    [personalId, inicio, fin, excluir || null]
  );
  if (solapa.rowCount)
    throw new ErrorConflicto(
      'El personal tiene otro turno o una ausencia en ese intervalo'
    );
};
const intervalo = (d) => {
  const inicio = new Date(`${d.fecha}T${d.horaInicio}-05:00`),
    fin = new Date(`${d.fecha}T${d.horaFin}-05:00`);
  if (+fin <= +inicio) fin.setUTCDate(fin.getUTCDate() + 1);
  return { inicio, fin };
};
const comprobarAsignacion = async (c, servicioId, personalId) => {
  if (!personalId) return;
  if (!(await c.query('SELECT 1 FROM servicio_personal WHERE servicio_id=$1 AND personal_id=$2 AND NOT eliminado', [servicioId, personalId])).rowCount)
    throw new ErrorConflicto('El personal no está asignado a este servicio. Vincúlelo desde Servicios antes de programar el turno');
};
const crearTurno = async (d, u) =>
  tx(u.id, 'Programación de plaza-turno', async (c) => {
    const { inicio, fin } = intervalo(d);
    if (!Number.isFinite(+inicio) || !Number.isFinite(+fin))
      throw new ErrorValidacion('Fecha u horario inválidos');
    if (u.rol === 'supervisor' && d.personalId) {
      const p = (
        await c.query('SELECT cargo FROM personal WHERE id=$1', [d.personalId])
      ).rows[0];
      if (p?.cargo !== 'agente')
        throw new ErrorAutorizacion('Solo puede asignar agentes');
    }
    await disponible(c, d.personalId, inicio, fin);
    const s = (
      await c.query('SELECT * FROM servicios WHERE id=$1 AND NOT eliminado', [
        d.servicioId,
      ])
    ).rows[0];
    if (!s) throw new ErrorValidacion('Servicio no válido');
    await comprobarAsignacion(c, d.servicioId, d.personalId);
    const creado = (
      await c.query(
        `INSERT INTO turnos(personal_id,servicio_id,sede_id,fecha,hora_inicio,hora_fin,estado,creado_por,puesto,funcion,evidencias_requeridas,evidencias_registradas,evidencia_limite)
    VALUES($1,$2,$3,$4,$5,$6,'sin_confirmar',$7,$8,$9,$10,0,$11) RETURNING *`,
        [
          d.personalId || null,
          d.servicioId,
          d.sedeId,
          d.fecha,
          d.horaInicio,
          d.horaFin,
          u.id,
          d.puesto || null,
          d.funcion || null,
          d.evidenciasRequeridas ?? 1,
          d.evidenciaLimite || fin,
        ]
      )
    ).rows[0];
    return (await c.query('SELECT * FROM turnos WHERE id=$1',[creado.id])).rows[0];
  });
const reasignar = async (id, d, u) =>
  tx(u.id, d.motivo, async (c) => {
    const t = await comprobarAcceso(c, id, u);
    if (!esGestor(u)) throw new ErrorAutorizacion();
    if (t.estado === 'cumplido' || t.ingreso_real)
      throw new ErrorConflicto(
        'Un turno ejecutado requiere corrección de asistencia; no se puede reemplazar su agente'
      );
    if (t.personal_id === d.personalId)
      throw new ErrorConflicto('Seleccione un agente diferente');
    const intervaloTurno = (
      await c.query(
        'SELECT inicio_programado,fin_programado FROM vw_operacion_turnos WHERE id=$1',
        [id]
      )
    ).rows[0];
    await disponible(
      c,
      d.personalId,
      intervaloTurno.inicio_programado,
      intervaloTurno.fin_programado,
      id
    );
    const p = (
      await c.query('SELECT cargo FROM personal WHERE id=$1', [d.personalId])
    ).rows[0];
    if (u.rol === 'supervisor' && p.cargo !== 'agente')
      throw new ErrorAutorizacion('Solo puede asignar agentes');
    await comprobarAsignacion(c, t.servicio_id, d.personalId);
    return (
      await c.query(
        "UPDATE turnos SET personal_id=$1,estado='sin_confirmar',relevo_pendiente=FALSE,motivo_rechazo=NULL,actualizado_en=NOW() WHERE id=$2 RETURNING *",
        [d.personalId, id]
      )
    ).rows[0];
  });
const asistencia = async (id, d, u) =>
  tx(u.id, d.motivo, async (c) => {
    const t = await comprobarAcceso(c, id, u);
    if (!t.personal_id)
      throw new ErrorConflicto('Asigne personal antes de registrar asistencia');
    if (d.accion) {
      if (t.asistencia_validada && (d.accion !== 'salida' || t.salida_real || !t.ingreso_real || t.estado === 'cumplido'))
        throw new ErrorConflicto(
          'La asistencia validada solo puede corregirse por supervisión'
        );
      if (d.accion === 'ingreso' && t.ingreso_real)
        throw new ErrorConflicto('Ya se registró el ingreso');
      if (d.accion === 'salida' && !t.ingreso_real)
        throw new ErrorConflicto('Registre primero el ingreso');
      if (d.accion === 'salida' && t.salida_real)
        throw new ErrorConflicto('Ya se registró la salida');
      if (t.estado === 'cumplido') throw new ErrorConflicto('El turno ya está finalizado');
      if (d.accion === 'ingreso' && !['confirmado', 'pendiente'].includes(t.estado))
        throw new ErrorConflicto('Confirme el turno antes de marcar ingreso');
      if (t.ingreso_real && +new Date(t.ingreso_real) >= Date.now())
        throw new ErrorConflicto('La salida debe ser posterior al ingreso');
      const col = d.accion === 'ingreso' ? 'ingreso_real' : 'salida_real';
      return (
        await c.query(
          `UPDATE turnos SET ${col}=NOW(),asistencia_validada=FALSE,actualizado_en=NOW() WHERE id=$1 RETURNING *`,
          [id]
        )
      ).rows[0];
    }
    if (!esGestor(u))
      throw new ErrorAutorizacion(
        'Solo supervisión puede validar o corregir la asistencia'
      );
    if (d.salidaReal && !d.ingresoReal)
      throw new ErrorValidacion('Una salida requiere ingreso');
    if (
      (d.ingresoReal && +new Date(d.ingresoReal) > Date.now()) ||
      (d.salidaReal && +new Date(d.salidaReal) > Date.now())
    )
      throw new ErrorValidacion('No se pueden registrar marcaciones futuras');
    if (d.salidaReal && +new Date(d.salidaReal) <= +new Date(d.ingresoReal))
      throw new ErrorValidacion('La salida debe ser posterior al ingreso');
    if ((d.evidenciasRegistradas || 0) > 0 && !d.evidenciaRegistro)
      throw new ErrorValidacion('Indique cuándo se registraron las evidencias');
    if (d.evidenciaRegistro && +new Date(d.evidenciaRegistro) > Date.now())
      throw new ErrorValidacion('El registro de evidencia no puede ser futuro');
    return (
      await c.query(
        `UPDATE turnos SET ingreso_real=$2,salida_real=$3,asistencia_validada=$4,tolerancia_min=$5,
    evidencias_requeridas=$6,evidencias_registradas=$7,evidencia_limite=$8,evidencia_registro=$9,puesto=$10,
    estado=CASE WHEN $3::timestamptz IS NOT NULL AND $4 THEN 'cumplido' ELSE CASE WHEN estado='cumplido' THEN 'pendiente' ELSE estado END END,actualizado_en=NOW() WHERE id=$1 RETURNING *`,
        [
          id,
          d.ingresoReal || null,
          d.salidaReal || null,
          d.validada,
          d.toleranciaMin,
          d.evidenciasRequeridas,
          d.evidenciasRegistradas,
          d.evidenciaLimite || null,
          d.evidenciaRegistro || null,
          d.puesto || null,
        ]
      )
    ).rows[0];
  });
const historial = async (id, u) => {
  await comprobarAcceso(pool, id, u);
  return (
    await pool.query(
      `SELECT h.*,u.nombre AS usuario,p1.nombres||' '||p1.apellidos AS personal_anterior,p2.nombres||' '||p2.apellidos AS personal_nuevo
    FROM turnos_historial h LEFT JOIN usuarios u ON u.id=h.usuario_id
    LEFT JOIN personal p1 ON p1.id=(h.anterior->>'personal_id')::int LEFT JOIN personal p2 ON p2.id=(h.nuevo->>'personal_id')::int
    WHERE h.turno_id=$1 ORDER BY h.id DESC`,
      [id]
    )
  ).rows;
};
const personalDisponible = async (inicio, fin) => {
  const a = inicio ? new Date(inicio) : new Date(),
    b = fin ? new Date(fin) : new Date(+a + 3600000);
  if (!Number.isFinite(+a) || !Number.isFinite(+b) || b <= a)
    throw new ErrorValidacion('Intervalo de disponibilidad inválido');
  return (
    await pool.query(
      `SELECT p.* FROM personal p WHERE NOT p.eliminado AND p.estado='activo' AND p.cargo='agente'
    AND NOT EXISTS(SELECT 1 FROM vw_operacion_turnos t WHERE t.personal_id=p.id AND t.inicio_programado<$2 AND t.fin_programado>$1)
    AND NOT EXISTS(SELECT 1 FROM personal_ausencias a WHERE a.personal_id=p.id AND NOT a.eliminado AND a.inicio<$2 AND a.fin>$1) ORDER BY p.apellidos`,
      [a, b]
    )
  ).rows.filter((p) => cubreHorario(p, a, b));
};
const opcionesTurno = async (q, u) => {
  const fecha = q.fecha || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new ErrorValidacion('Fecha inválida');
  if ((q.horaInicio || q.horaFin) && (!/^\d{2}:\d{2}(:\d{2})?$/.test(q.horaInicio || '') || !/^\d{2}:\d{2}(:\d{2})?$/.test(q.horaFin || '')))
    throw new ErrorValidacion('Complete ambas horas');
  const catalogo = await repo.catalogos();
  const servicios = catalogo.servicios.filter((s) => s.estado !== 'finalizado' && s.fecha_inicio <= fecha && (!s.fecha_fin || s.fecha_fin >= fecha));
  const ventanas = servicios.map((s) => ({servicio_id:s.id,...intervalo({fecha,horaInicio:q.horaInicio || s.hora_inicio,horaFin:q.horaFin || s.hora_fin})}));
  if (ventanas.some((v) => !Number.isFinite(+v.inicio) || !Number.isFinite(+v.fin))) throw new ErrorValidacion('Fecha u horario inválidos');
  const candidatos = (await pool.query(`SELECT DISTINCT p.*,x.servicio_id,x.inicio,x.fin
      FROM jsonb_to_recordset($1::jsonb) AS x(servicio_id int,inicio timestamptz,fin timestamptz)
      JOIN servicio_personal sp ON sp.servicio_id=x.servicio_id JOIN personal p ON sp.personal_id=p.id
      WHERE NOT sp.eliminado AND NOT p.eliminado AND p.estado='activo'
      AND ($3::boolean=FALSE OR p.cargo='agente')
      AND NOT EXISTS(SELECT 1 FROM vw_operacion_turnos t WHERE t.personal_id=p.id AND t.id<>COALESCE($2::int,0) AND t.inicio_programado<x.fin AND t.fin_programado>x.inicio)
      AND NOT EXISTS(SELECT 1 FROM personal_ausencias a WHERE a.personal_id=p.id AND NOT a.eliminado AND a.inicio<x.fin AND a.fin>x.inicio)`,
      [JSON.stringify(ventanas),q.excluirId || null,u.rol==='supervisor'])).rows;
  const pares = candidatos.filter((p) => cubreHorario(p,p.inicio,p.fin)).map((p) => ({servicioId:p.servicio_id,personalId:p.id}));
  return { servicios, compatibilidades: pares };
};
const resultado = async (q) => evaluarFuentes(await repo.fuentes(), q);
const guardarEvaluacion = async (q, u) => {
  const data = await resultado(q);
  await tx(u.id, 'Evaluación operativo-v4', async (c) => {
    await c.query('SELECT bi.refrescar()');
    for (const s of data.tabla)
      await c.query(
        'INSERT INTO evaluaciones_operativas(servicio_id,usuario_id,version,filtros,resultado) VALUES($1,$2,$3,$4,$5)',
        [s.id, u.id, data.version, data.filtros, s]
      );
  });
  return data;
};
const cambiarTurno = async (id, accion, d, u) =>
  tx(u.id, d.motivo || accion, async (c) => {
    const t = await comprobarAcceso(c, id, u);
    if (accion === 'eliminar') {
      if (!esGestor(u)) throw new ErrorAutorizacion();
      return (
        await c.query(
          'UPDATE turnos SET eliminado=TRUE,eliminado_por=$2,eliminado_en=NOW(),actualizado_en=NOW() WHERE id=$1 RETURNING *',
          [id, u.id]
        )
      ).rows[0];
    }
    if (!t.personal_id) throw new ErrorConflicto('Asigne personal al turno');
    if (t.estado === 'cumplido')
      throw new ErrorConflicto('El turno ya está cumplido');
    if (accion === 'confirmar') {
      if (t.relevo_pendiente)
        throw new ErrorConflicto('Resuelva la reasignación antes de confirmar');
      return (
        await c.query(
          "UPDATE turnos SET estado='confirmado',actualizado_en=NOW() WHERE id=$1 RETURNING *",
          [id]
        )
      ).rows[0];
    }
    if (accion === 'rechazar') {
      if (t.ingreso_real)
        throw new ErrorConflicto(
          'No se puede rechazar un turno con ingreso registrado'
        );
      if (!d.motivo?.trim())
        throw new ErrorValidacion('Indique el motivo del rechazo');
      return (
        await c.query(
          "UPDATE turnos SET relevo_pendiente=TRUE,estado='sin_confirmar',motivo_rechazo=$2,actualizado_en=NOW() WHERE id=$1 RETURNING *",
          [id, d.motivo]
        )
      ).rows[0];
    }
    if (accion === 'cumplir') {
      if (!t.ingreso_real || !['confirmado', 'pendiente'].includes(t.estado))
        throw new ErrorConflicto(
          'Confirme el turno y registre su ingreso antes de culminarlo'
        );
      const urls = [...new Set((d.evidencias || []).map((e) =>
        typeof e === 'string' ? e : e.url
      ))];
      const existentes = new Set((t.evidencias || []).map((e) => typeof e === 'string' ? e : e.url));
      const demo = (await c.query('SELECT datos_demo FROM configuracion_operativa WHERE id=1')).rows[0]?.datos_demo;
      if (urls.some((url) => typeof url !== 'string' || (!/^https:\/\//i.test(url) && !(demo && existentes.has(url) && /^\/demo\/evidencia-operativa\.svg(?:\?|$)/.test(url)))))
        throw new ErrorValidacion('Las evidencias requieren una URL HTTPS');
      if (urls.length < (t.evidencias_requeridas ?? 1))
        throw new ErrorValidacion(
          'Faltan fotografías exigidas para culminar el turno'
        );
      if (!t.salida_real) throw new ErrorConflicto('Marque la salida antes de finalizar el turno');
      return (
        await c.query(
          "UPDATE turnos SET estado='cumplido',salida_real=COALESCE(salida_real,NOW()),evidencias=$2,evidencias_registradas=$3,evidencia_registro=NOW(),relevo_pendiente=FALSE,actualizado_en=NOW() WHERE id=$1 RETURNING *",
          [id, JSON.stringify(urls), urls.length]
        )
      ).rows[0];
    }
    throw new ErrorValidacion('Acción no válida');
  });
const actualizarTurno = async (id, d, u) =>
  tx(u.id, 'Corrección de programación', async (c) => {
    const t = await comprobarAcceso(c, id, u);
    if (!esGestor(u)) throw new ErrorAutorizacion();
    if (t.personal_id !== (d.personalId || null))
      throw new ErrorConflicto(
        'Use Reasignar para cambiar el personal con motivo e historial'
      );
    if (t.ingreso_real || t.estado === 'cumplido')
      throw new ErrorConflicto('El turno ya tiene ejecución registrada');
    const { inicio, fin } = intervalo(d);
    await disponible(c, d.personalId, inicio, fin, id);
    await comprobarAsignacion(c, d.servicioId, d.personalId);
    return (
      await c.query(
        'UPDATE turnos SET servicio_id=$2,sede_id=$3,fecha=$4,hora_inicio=$5,hora_fin=$6,puesto=$7,actualizado_en=NOW() WHERE id=$1 RETURNING *',
        [
          id,
          d.servicioId,
          d.sedeId,
          d.fecha,
          d.horaInicio,
          d.horaFin,
          d.puesto || t.puesto,
        ]
      )
    ).rows[0];
  });
module.exports = {
  crearTurno,
  reasignar,
  asistencia,
  historial,
  personalDisponible,
  opcionesTurno,
  resultado,
  guardarEvaluacion,
  disponible,
  intervalo,
  comprobarAcceso,
  cambiarTurno,
  actualizarTurno,
};

module.exports.crearAusencia = (d, u) =>
  tx(u.id, 'Registro de ausencia: ' + d.motivo, async (c) => {
    await c.query('SELECT pg_advisory_xact_lock($1)', [d.personalId]);
    return (
      await c.query(
        'INSERT INTO personal_ausencias(personal_id,inicio,fin,motivo,creado_por) VALUES($1,$2,$3,$4,$5) RETURNING *',
        [d.personalId, d.inicio, d.fin, d.motivo, u.id]
      )
    ).rows[0];
  });

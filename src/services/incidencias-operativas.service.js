'use strict';
const tx = require('../utils/transaccion');
const {
  ErrorValidacion,
  ErrorNoEncontrado,
  ErrorConflicto,
} = require('../utils/errores');
const guardar = async (id, d, u) =>
  tx(u, 'Registro y seguimiento de incidencia', async (c) => {
    const actual = id
      ? (
          await c.query(
            'SELECT * FROM incidencias WHERE id=$1 AND NOT eliminado FOR UPDATE',
            [id]
          )
        ).rows[0]
      : null;
    if (id && !actual) throw new ErrorNoEncontrado();
    const datos = {
      ...actual,
      ...Object.fromEntries(
        Object.entries({
          tipo_incidencia_id: d.tipoIncidenciaId,
          servicio_id: d.servicioId,
          personal_id: d.personalId,
          descripcion: d.descripcion,
          prioridad: d.prioridad,
          estado: d.estado,
          observacion: d.observacion,
          responsable_id: d.responsableId,
          turno_id: d.turnoId,
          sla_min: d.slaMin,
        }).filter(([, v]) => v !== undefined)
      ),
    };
    if (!datos.responsable_id)
      throw new ErrorValidacion('Seleccione un responsable de atención');
    const responsable = (
      await c.query(
        "SELECT id FROM personal WHERE id=$1 AND NOT eliminado AND estado='activo'",
        [datos.responsable_id]
      )
    ).rows[0];
    if (!responsable) throw new ErrorValidacion('Responsable no válido');
    if (
      datos.turno_id &&
      !(
        await c.query(
          'SELECT id FROM turnos WHERE id=$1 AND servicio_id=$2 AND NOT eliminado',
          [datos.turno_id, datos.servicio_id]
        )
      ).rowCount
    )
      throw new ErrorValidacion('El turno debe pertenecer al servicio');
    if (!datos.sla_min) {
      const cfg = (
        await c.query('SELECT * FROM configuracion_operativa WHERE id=1')
      ).rows[0];
      datos.sla_min = cfg['sla_' + datos.prioridad];
    }
    const estado = datos.estado || 'abierta';
    if (estado === 'cerrada' && !actual?.fecha_atencion)
      throw new ErrorConflicto('Atienda la incidencia antes de cerrarla');
    if (id)
      return (
        await c.query(
          `UPDATE incidencias SET tipo_incidencia_id=$2,servicio_id=$3,descripcion=$4,prioridad=$5,estado=$6::text,observacion=$7,responsable_id=$8,turno_id=$9,sla_min=$10,
  fecha_atencion=CASE WHEN $6::text='en_atencion' THEN COALESCE(fecha_atencion,NOW()) ELSE fecha_atencion END,
  fecha_cierre=CASE WHEN $6::text='cerrada' THEN COALESCE(fecha_cierre,NOW()) ELSE NULL END,actualizado_en=NOW() WHERE id=$1 RETURNING *`,
          [
            id,
            datos.tipo_incidencia_id,
            datos.servicio_id,
            datos.descripcion,
            datos.prioridad,
            estado,
            datos.observacion || null,
            datos.responsable_id,
            datos.turno_id || null,
            datos.sla_min,
          ]
        )
      ).rows[0];
    const seq = (await c.query("SELECT nextval('seq_incidencias') AS n"))
      .rows[0].n;
    return (
      await c.query(
        `INSERT INTO incidencias(codigo,tipo_incidencia_id,servicio_id,personal_id,descripcion,prioridad,registrado_por,responsable_id,turno_id,sla_min) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          'INC-' + String(seq).padStart(4, '0'),
          datos.tipo_incidencia_id,
          datos.servicio_id,
          datos.personal_id || null,
          datos.descripcion,
          datos.prioridad,
          u,
          datos.responsable_id,
          datos.turno_id || null,
          datos.sla_min,
        ]
      )
    ).rows[0];
  });
module.exports = { guardar };

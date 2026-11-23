'use strict';

const pool = require('../config/db');

const resumenSupervisor = async (u) => {
  const ids=await require('../services/acceso-servicios').serviciosPermitidos(u);
  const {alcancePersonal}=require('../services/acceso-servicios');
  return (await pool.query(`WITH ss AS(SELECT * FROM servicios WHERE NOT eliminado AND id=ANY($1::int[])),
    pp AS(SELECT p.* FROM personal p WHERE NOT p.eliminado AND ${alcancePersonal(u,'$2')}),
    ii AS(SELECT i.* FROM incidencias i JOIN ss ON ss.id=i.servicio_id WHERE NOT i.eliminado)
    SELECT (SELECT COUNT(*) FROM pp WHERE estado='activo') personal_activo,
      (SELECT COUNT(*) FROM ss WHERE estado='en_curso') servicios_en_curso,
      (SELECT COUNT(*) FROM ii WHERE estado<>'cerrada') incidencias_abiertas,
      (SELECT ROUND(AVG(EXTRACT(EPOCH FROM(fecha_atencion-fecha_registro))/60)::numeric,1) FROM ii WHERE fecha_atencion IS NOT NULL) tiempo_prom_atencion,
      (SELECT COUNT(*) FROM pp WHERE estado='activo' AND creado_en>=NOW()-INTERVAL '7 days') personal_nuevo_semana,
      (SELECT COUNT(*) FROM ss WHERE estado='en_curso' AND creado_en>=NOW()-INTERVAL '7 days') servicios_nuevos_semana,
      (SELECT COUNT(*) FROM ii WHERE estado<>'cerrada' AND fecha_registro>=NOW()-INTERVAL '1 day') incidencias_ayer`,[ids,u.id])).rows[0];
};

// Los registros de actividad general no contienen servicio_id. Para supervisión,
// usar trazas con relaciones explícitas, sin inferir permisos desde descripciones.
const eventosSupervisor = `SELECT h.id,'turno_actualizado'::text tipo,
    'Turno · '||s.nombre||' · '||COALESCE(h.nuevo->>'estado','actualizado') descripcion,h.creado_en
  FROM turnos_historial h JOIN turnos t ON t.id=h.turno_id JOIN servicios s ON s.id=t.servicio_id
  WHERE NOT t.eliminado AND NOT s.eliminado AND s.id=ANY($1::int[])
  UNION ALL SELECT e.id,'incidencia_'||e.accion,i.codigo||' · '||s.nombre||' · '||
    CASE e.accion WHEN 'registrar' THEN 'Reportada' WHEN 'atender' THEN 'Atención iniciada' WHEN 'resolver' THEN 'Resuelta'
    WHEN 'solicitar_ampliacion' THEN 'Ampliación solicitada' WHEN 'aprobar_ampliacion' THEN 'Ampliación aprobada'
    WHEN 'rechazar_ampliacion' THEN 'Ampliación rechazada' ELSE 'Seguimiento registrado' END,e.creado_en
  FROM incidencias_seguimiento e JOIN incidencias i ON i.id=e.incidencia_id JOIN servicios s ON s.id=i.servicio_id
  WHERE NOT i.eliminado AND NOT s.eliminado AND s.id=ANY($1::int[])`;

const obtenerResumen = async (u) => {
  if(u?.rol==='supervisor')return resumenSupervisor(u);
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM personal WHERE eliminado = FALSE AND estado = 'activo') AS personal_activo,
      (SELECT COUNT(*) FROM servicios WHERE eliminado = FALSE AND estado = 'en_curso') AS servicios_en_curso,
      (SELECT COUNT(*) FROM incidencias WHERE eliminado = FALSE AND estado != 'cerrada') AS incidencias_abiertas,
      (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (fecha_atencion - fecha_registro)) / 60)::NUMERIC, 1)
       FROM incidencias WHERE eliminado = FALSE AND fecha_atencion IS NOT NULL) AS tiempo_prom_atencion,
      (SELECT COUNT(*) FROM personal WHERE eliminado = FALSE AND estado = 'activo'
       AND creado_en >= NOW() - INTERVAL '7 days') AS personal_nuevo_semana,
      (SELECT COUNT(*) FROM servicios WHERE eliminado = FALSE AND estado = 'en_curso'
       AND creado_en >= NOW() - INTERVAL '7 days') AS servicios_nuevos_semana,
      (SELECT COUNT(*) FROM incidencias WHERE eliminado = FALSE AND estado != 'cerrada'
       AND fecha_registro >= NOW() - INTERVAL '1 day') AS incidencias_ayer
  `);
  return rows[0];
};

const obtenerActividadOperativa = async (u) => {
  if(u?.rol==='supervisor'){
    const ids=await require('../services/acceso-servicios').serviciosPermitidos(u);
    return (await pool.query(`WITH eventos AS(${eventosSupervisor})
      SELECT DATE_TRUNC('hour',creado_en) hora,COUNT(*) eventos FROM eventos
      WHERE creado_en>=NOW()-INTERVAL '24 hours' AND creado_en<=NOW() GROUP BY 1 ORDER BY 1`,[ids])).rows;
  }
  const { rows } = await pool.query(`
    SELECT
      DATE_TRUNC('hour', creado_en) AS hora,
      COUNT(*) AS eventos
    FROM actividad_reciente
    WHERE creado_en >= NOW() - INTERVAL '24 hours'
    GROUP BY DATE_TRUNC('hour', creado_en)
    ORDER BY hora
  `);
  return rows;
};

const obtenerActividadReciente = async (u) => {
  if(u?.rol==='supervisor'){
    const ids=await require('../services/acceso-servicios').serviciosPermitidos(u);
    return (await pool.query(`WITH eventos AS(${eventosSupervisor})
      SELECT tipo,descripcion,creado_en FROM eventos WHERE creado_en<=NOW() ORDER BY creado_en DESC,tipo,id DESC LIMIT 10`,[ids])).rows;
  }
  const { rows } = await pool.query(
    `SELECT tipo, descripcion, creado_en
     FROM actividad_reciente ORDER BY creado_en DESC LIMIT 10`
  );
  return rows;
};

module.exports = { obtenerResumen, obtenerActividadOperativa, obtenerActividadReciente };

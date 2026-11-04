'use strict';

const pool = require('../config/db');

const listarMonitor = async ({ estado, sedeId, clienteId }) => {
  const condiciones = ['s.eliminado = FALSE'];
  const valores = [];
  let idx = 1;

  if (estado) {
    condiciones.push(`s.estado = $${idx}`);
    valores.push(estado);
    idx++;
  }
  if (sedeId) {
    condiciones.push(`s.sede_id = $${idx}`);
    valores.push(sedeId);
    idx++;
  }
  if (clienteId) {
    condiciones.push(`s.cliente_id = $${idx}`);
    valores.push(clienteId);
    idx++;
  }

  const where = condiciones.join(' AND ');

  const { rows } = await pool.query(
    `SELECT s.id, s.nombre, s.estado, s.hora_inicio, s.hora_fin,
            TO_CHAR(s.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
            TO_CHAR(s.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
            c.nombre AS cliente, se.nombre AS sede,
            CONCAT(p.nombres, ' ', p.apellidos) AS supervisor,
            (SELECT COUNT(*) FROM servicio_personal sp WHERE sp.servicio_id = s.id AND sp.eliminado = FALSE) AS personal_asignado,
            (SELECT COUNT(*) FROM incidencias i WHERE i.servicio_id = s.id AND i.eliminado = FALSE AND i.estado = 'abierta') AS incidencias_abiertas,
            (SELECT COUNT(*) FROM evidencias_servicio ev WHERE ev.servicio_id = s.id AND ev.eliminado = FALSE) AS evidencias_registradas,
            (SELECT COUNT(*) FROM servicio_protocolos sproc WHERE sproc.servicio_id = s.id AND sproc.eliminado = FALSE) AS protocolos_asociados
     FROM servicios s
     JOIN clientes c ON s.cliente_id = c.id
     JOIN sedes se ON s.sede_id = se.id
     JOIN personal p ON s.supervisor_id = p.id
     WHERE ${where}
     ORDER BY CASE s.estado WHEN 'en_curso' THEN 1 WHEN 'programado' THEN 2 ELSE 3 END, s.nombre`,
    valores
  );

  return rows;
};

const obtenerDetalleOperativo = async (id) => {
  const { rows: [servicio] } = await pool.query(
    `SELECT s.id, s.nombre, s.estado, s.hora_inicio, s.hora_fin,
            TO_CHAR(s.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
            TO_CHAR(s.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
            c.nombre AS cliente, se.nombre AS sede,
            CONCAT(p.nombres, ' ', p.apellidos) AS supervisor
     FROM servicios s
     JOIN clientes c ON s.cliente_id = c.id
     JOIN sedes se ON s.sede_id = se.id
     JOIN personal p ON s.supervisor_id = p.id
     WHERE s.id = $1 AND s.eliminado = FALSE`,
    [id]
  );

  if (!servicio) return null;

  const { rows: personal } = await pool.query(
    `SELECT p.id, p.nombres, p.apellidos, p.cargo, p.estado
     FROM personal p
     JOIN servicio_personal sp ON p.id = sp.personal_id
     WHERE sp.servicio_id = $1 AND sp.eliminado = FALSE AND p.eliminado = FALSE`,
    [id]
  );

  const { rows: protocolos } = await pool.query(
    `SELECT p.id, p.codigo, p.nombre, p.descripcion
     FROM protocolos p
     JOIN servicio_protocolos sp ON p.id = sp.protocolo_id
     WHERE sp.servicio_id = $1 AND sp.eliminado = FALSE AND p.eliminado = FALSE`,
    [id]
  );

  const { rows: evidencias } = await pool.query(
    `SELECT ev.id, ev.titulo, ev.descripcion, ev.estado_revision,
            ev.creado_en, pr.nombre AS protocolo,
            CONCAT(p.nombres, ' ', p.apellidos) AS personal
     FROM evidencias_servicio ev
     LEFT JOIN protocolos pr ON ev.protocolo_id = pr.id
     LEFT JOIN personal p ON ev.personal_id = p.id
     WHERE ev.servicio_id = $1 AND ev.eliminado = FALSE
     ORDER BY ev.creado_en DESC
     LIMIT 10`,
    [id]
  );

  const { rows: incidencias } = await pool.query(
    `SELECT i.id, i.codigo, i.estado, i.prioridad, i.descripcion,
            i.fecha_registro, ti.nombre AS tipo
     FROM incidencias i
     JOIN tipos_incidencia ti ON i.tipo_incidencia_id = ti.id
     WHERE i.servicio_id = $1 AND i.eliminado = FALSE
     ORDER BY i.fecha_registro DESC
     LIMIT 10`,
    [id]
  );

  return { ...servicio, personal, protocolos, evidencias, incidencias };
};

// Cada fuente se agrega antes de combinarla: evita productos cartesianos.
const filtrosServicios = ({ servicioId, sedeId, clienteId }, valores) => {
  const condiciones = ['NOT s.eliminado'];
  for (const [campo, valor] of [['s.id', servicioId], ['s.sede_id', sedeId], ['s.cliente_id', clienteId]]) {
    if (valor) { valores.push(valor); condiciones.push(campo + '=$' + valores.length); }
  }
  return condiciones.join(' AND ');
};
const dias = (valor, defecto = 30) => {
  const n = Number(valor ?? defecto);
  if (!Number.isInteger(n) || n < 1 || n > 3650) throw new (require('../utils/errores').ErrorValidacion)('Periodo inválido');
  return n;
};
const obtenerIndicadoresOperativos = async (f = {}) => {
  const valores = [dias(f.periodo)];
  const where = filtrosServicios(f, valores);
  const { rows: [r] } = await pool.query(`
    WITH ss AS (SELECT s.* FROM servicios s WHERE ${where}),
    tt AS (SELECT COUNT(*) total,COUNT(*) FILTER(WHERE t.estado='cumplido') cumplidos
      FROM turnos t JOIN ss ON ss.id=t.servicio_id WHERE NOT t.eliminado AND t.fecha>=CURRENT_DATE-$1::int AND t.fecha<=CURRENT_DATE),
    ii AS (SELECT COUNT(*) total,COUNT(*) FILTER(WHERE i.estado<>'cerrada') abiertas,
      COUNT(*) FILTER(WHERE i.estado='cerrada') cerradas,
      ROUND(AVG(EXTRACT(EPOCH FROM(i.fecha_atencion-i.fecha_registro))/60) FILTER(WHERE i.fecha_atencion IS NOT NULL),0) tiempo
      FROM incidencias i JOIN ss ON ss.id=i.servicio_id WHERE NOT i.eliminado AND i.fecha_registro>=CURRENT_DATE-$1::int AND i.fecha_registro<=NOW()),
    ee AS (SELECT COUNT(*) total,COUNT(*) FILTER(WHERE e.estado_revision='aprobada') aprobadas
      FROM evidencias_servicio e JOIN ss ON ss.id=e.servicio_id WHERE NOT e.eliminado AND e.creado_en>=CURRENT_DATE-$1::int AND e.creado_en<=NOW()),
    pp AS (SELECT COUNT(DISTINCT sp.personal_id) total FROM servicio_personal sp JOIN ss ON ss.id=sp.servicio_id JOIN personal p ON p.id=sp.personal_id WHERE NOT sp.eliminado AND NOT p.eliminado AND p.estado='activo')
    SELECT (SELECT COUNT(*) FROM ss) total_servicios,
      (SELECT COUNT(*) FROM ss WHERE estado='en_curso') en_curso,
      (SELECT COUNT(*) FROM ss WHERE estado='finalizado') finalizados,
      tt.total total_turnos,tt.cumplidos turnos_cumplidos,ROUND(tt.cumplidos::numeric/NULLIF(tt.total,0)*100,1) cumplimiento_turnos,
      ii.total total_incidencias,ii.abiertas incidencias_abiertas,ii.cerradas incidencias_cerradas,ii.tiempo tiempo_prom_atencion_min,
      ee.total total_evidencias,ee.aprobadas evidencias_aprobadas,pp.total personal_activo FROM tt CROSS JOIN ii CROSS JOIN ee CROSS JOIN pp`, valores);
  return r;
};
const obtenerHistorialIndicadores = async (f = {}) => {
  const meses = dias(f.periodos, 6);
  if(meses>120) throw new (require('../utils/errores').ErrorValidacion)('Máximo 120 meses');
  const valores = [meses];
  const where = filtrosServicios(f, valores);
  const { rows } = await pool.query(`
    WITH ss AS (SELECT s.id FROM servicios s WHERE ${where}),
    meses AS (SELECT generate_series(DATE_TRUNC('month',CURRENT_DATE)-($1::int-1)*INTERVAL '1 month',DATE_TRUNC('month',CURRENT_DATE),INTERVAL '1 month') mes),
    tt AS (SELECT DATE_TRUNC('month',t.fecha) mes,COUNT(*) total,COUNT(*) FILTER(WHERE t.estado='cumplido') cumplidos
      FROM turnos t JOIN ss ON ss.id=t.servicio_id WHERE NOT t.eliminado AND t.fecha>=(SELECT MIN(mes) FROM meses) AND t.fecha<=CURRENT_DATE GROUP BY 1),
    ii AS (SELECT DATE_TRUNC('month',i.fecha_registro AT TIME ZONE 'America/Lima') mes,
      COUNT(*) FILTER(WHERE i.estado<>'cerrada') abiertas,COUNT(*) FILTER(WHERE i.estado='cerrada') cerradas,
      ROUND(AVG(EXTRACT(EPOCH FROM(i.fecha_atencion-i.fecha_registro))/60) FILTER(WHERE i.fecha_atencion IS NOT NULL),0) tiempo
      FROM incidencias i JOIN ss ON ss.id=i.servicio_id WHERE NOT i.eliminado AND i.fecha_registro>=((SELECT MIN(mes) FROM meses)::timestamp AT TIME ZONE 'America/Lima') AND i.fecha_registro<=NOW() GROUP BY 1)
    SELECT TO_CHAR(m.mes,'YYYY-MM') periodo,TO_CHAR(m.mes,'Mon YYYY') etiqueta,
      ROUND(tt.cumplidos::numeric/NULLIF(tt.total,0)*100,1) cumplimiento_turnos,
      COALESCE(ii.abiertas,0) incidencias_abiertas,COALESCE(ii.cerradas,0) incidencias_cerradas,ii.tiempo tiempo_prom_atencion
    FROM meses m LEFT JOIN tt ON tt.mes=m.mes LEFT JOIN ii ON ii.mes=m.mes ORDER BY m.mes`,valores);
  return rows;
};
const obtenerIndicadoresPorServicio = async (f = {}) => {
  const valores = [f.periodos ? dias(f.periodos)*30 : dias(f.periodo)];
  const where = filtrosServicios(f, valores);
  // periodos se expresa en meses para Análisis Histórico.
  const limite = f.periodos ? "DATE_TRUNC('month',CURRENT_DATE)-($1::int/30-1)*INTERVAL '1 month'" : 'CURRENT_DATE-$1::int';
  const { rows } = await pool.query(`
    WITH ss AS (SELECT s.id,s.nombre,s.estado,s.cliente_id FROM servicios s WHERE ${where}),
    tt AS (SELECT t.servicio_id,COUNT(*) total,COUNT(*) FILTER(WHERE t.estado='cumplido') cumplidos FROM turnos t JOIN ss ON ss.id=t.servicio_id WHERE NOT t.eliminado AND t.fecha>=${limite} AND t.fecha<=CURRENT_DATE GROUP BY 1),
    ii AS (SELECT i.servicio_id,COUNT(*) FILTER(WHERE i.estado<>'cerrada') abiertas,
      ROUND(AVG(EXTRACT(EPOCH FROM(i.fecha_atencion-i.fecha_registro))/60) FILTER(WHERE i.fecha_atencion IS NOT NULL),0) tiempo FROM incidencias i JOIN ss ON ss.id=i.servicio_id WHERE NOT i.eliminado AND i.fecha_registro>=${limite} AND i.fecha_registro<=NOW() GROUP BY 1),
    ee AS (SELECT e.servicio_id,COUNT(*) total FROM evidencias_servicio e JOIN ss ON ss.id=e.servicio_id WHERE NOT e.eliminado AND e.creado_en>=${limite} AND e.creado_en<=NOW() GROUP BY 1)
    SELECT ss.id,ss.nombre,ss.estado,c.nombre cliente,ROUND(tt.cumplidos::numeric/NULLIF(tt.total,0)*100,1) cumplimiento_turnos,
      COALESCE(ii.abiertas,0) incidencias_abiertas,COALESCE(ee.total,0) evidencias,ii.tiempo tiempo_prom_atencion
    FROM ss JOIN clientes c ON c.id=ss.cliente_id LEFT JOIN tt ON tt.servicio_id=ss.id LEFT JOIN ii ON ii.servicio_id=ss.id LEFT JOIN ee ON ee.servicio_id=ss.id ORDER BY cumplimiento_turnos DESC NULLS LAST`,valores);
  return rows;
};
module.exports = { listarMonitor, obtenerDetalleOperativo, obtenerIndicadoresOperativos, obtenerHistorialIndicadores, obtenerIndicadoresPorServicio };

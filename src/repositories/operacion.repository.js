'use strict';
const pool = require('../config/db');
const fuentes = async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const servicios = (
      await c.query(
        `SELECT s.*, c.nombre AS cliente FROM servicios s JOIN clientes c ON c.id=s.cliente_id WHERE NOT s.eliminado`
      )
    ).rows;
    const turnos = (
      await c.query(
        `SELECT t.*,base.plan_kpi_validado,TO_CHAR(t.fecha,'YYYY-MM-DD') AS dia FROM vw_operacion_turnos t JOIN turnos base ON base.id=t.id JOIN servicios s ON s.id=t.servicio_id WHERE NOT s.eliminado`
      )
    ).rows;
    const incidencias = (
      await c.query(`SELECT i.*,s.nombre AS servicio,ti.nombre AS tipo,CONCAT(p.nombres,' ',p.apellidos) AS responsable
      FROM incidencias i JOIN servicios s ON s.id=i.servicio_id JOIN tipos_incidencia ti ON ti.id=i.tipo_incidencia_id LEFT JOIN personal p ON p.id=i.responsable_id WHERE NOT i.eliminado AND NOT s.eliminado`)
    ).rows;
    const criterios = (
      await c.query('SELECT * FROM modelo_operativo ORDER BY codigo')
    ).rows;
    const corte = (await c.query('SELECT NOW() AS corte')).rows[0].corte;
    const entorno = (
      await c.query(
        'SELECT datos_demo,demo_generada_en FROM configuracion_operativa WHERE id=1'
      )
    ).rows[0];
    // Todas las fuentes y el corte pertenecen a la misma instantánea.
    const verificacionesConsignas = (await c.query(
      'SELECT v.*,t.servicio_id FROM verificaciones_consignas v JOIN turnos t ON t.id=v.turno_id JOIN consignas cn ON cn.id=v.consigna_id WHERE NOT t.eliminado AND NOT cn.eliminado AND cn.servicio_id=t.servicio_id'
    )).rows;
    const rondas = (await c.query('SELECT * FROM rondas WHERE NOT eliminado')).rows;
    const obligaciones = (await c.query('SELECT * FROM obligaciones_operativas WHERE NOT eliminado')).rows;
    const evidenciasServicio = (await c.query('SELECT * FROM evidencias_servicio WHERE NOT eliminado AND protocolo_id IS NOT NULL')).rows;
    await c.query('COMMIT');
    return {
      servicios,
      turnos,
      incidencias,
      criterios,
      corte,
      demo: entorno?.datos_demo,
      demo_generada_en: entorno?.demo_generada_en,
      verificacionesConsignas,
      rondas,
      obligaciones,
      evidenciasServicio,
    };
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
};
const catalogos = async (usuario) => {
  const [p, s, c] = await Promise.all([
    pool.query(
      'SELECT id,nombres,apellidos,documento,cargo,estado,sede_id,horario_inicio,horario_fin,dias_laborales FROM personal WHERE NOT eliminado ORDER BY apellidos,nombres'
    ),
    pool.query(
      'SELECT id,nombre FROM sedes WHERE NOT eliminado ORDER BY nombre'
    ),
    pool.query(
      "SELECT s.id,s.nombre,s.estado,s.sede_id,s.hora_inicio,s.hora_fin,TO_CHAR(s.fecha_inicio,'YYYY-MM-DD') AS fecha_inicio,TO_CHAR(s.fecha_fin,'YYYY-MM-DD') AS fecha_fin,COALESCE(p.confirmado,FALSE) AS plan_confirmado FROM servicios s LEFT JOIN planes_operativos p ON p.servicio_id=s.id WHERE NOT s.eliminado ORDER BY s.nombre"
    ),
  ]);
  const ids=await require('../services/acceso-servicios').serviciosPermitidos(usuario);
  return { personal: p.rows, sedes: s.rows, servicios: ids===null?c.rows:c.rows.filter(s=>ids.includes(s.id)) };
};
module.exports = { fuentes, catalogos };

module.exports.ausencias = () =>
  pool
    .query(
      `SELECT a.*,p.nombres||' '||p.apellidos AS personal FROM personal_ausencias a JOIN personal p ON p.id=a.personal_id WHERE NOT a.eliminado ORDER BY a.inicio DESC LIMIT 500`
    )
    .then((x) => x.rows);
module.exports.eliminarAusencia = (id) =>
  pool
    .query(
      'UPDATE personal_ausencias SET eliminado=TRUE WHERE id=$1 RETURNING id',
      [id]
    )
    .then((x) => x.rows[0]);
module.exports.responsables = () =>
  pool
    .query(
      "SELECT id,nombres||' '||apellidos AS nombre FROM personal WHERE NOT eliminado AND estado='activo' ORDER BY apellidos,nombres"
    )
    .then((x) => x.rows);
module.exports.turnosServicio = async (id, u) => {
  await require('../services/acceso-servicios').comprobar(id,u);
  return pool
    .query(
      `SELECT t.id,t.personal_id,t.ingreso_real,t.salida_real,t.estado,t.servicio_id,TO_CHAR(t.fecha,'YYYY-MM-DD') AS fecha,t.hora_inicio,t.hora_fin,t.puesto FROM turnos t LEFT JOIN personal p ON p.id=t.personal_id WHERE t.servicio_id=$1 AND NOT t.eliminado AND ($2::boolean OR p.usuario_id=$3) ORDER BY t.fecha DESC,t.hora_inicio`,
      [id, u.rol !== 'operador', u.id]
    )
    .then((x) => x.rows);
};

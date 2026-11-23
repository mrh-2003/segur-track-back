'use strict';

const pool = require('../config/db');

const listarPorSemana = async ({ desde, hasta, sedeId, usuario, estado }) => {
  const condiciones = ['t.eliminado = FALSE', 't.fecha BETWEEN $1 AND $2'];
  const valores = [desde, hasta];
  let idx = 3;

  if (sedeId) {
    condiciones.push(`t.sede_id = $${idx}`);
    valores.push(sedeId);
    idx++;
  }

  const ids=await require('../services/acceso-servicios').serviciosPermitidos(usuario);
  if(ids!==null && usuario?.rol!=='operador'){condiciones.push(`t.servicio_id=ANY($${idx}::int[])`);valores.push(ids);idx++;}
  if(usuario?.rol==='operador'){condiciones.push(`p.usuario_id=$${idx}`);valores.push(usuario.id);idx++;}
  if(estado){condiciones.push(`t.estado=$${idx}`);valores.push(estado);idx++;}
  const { rows } = await pool.query(
    `SELECT t.*, TO_CHAR(t.fecha, 'YYYY-MM-DD') AS fecha,
            t.hora_inicio, t.hora_fin, t.estado, t.relevo_pendiente,
            t.personal_id, t.servicio_id, t.sede_id, t.creado_por, t.motivo_rechazo,
            COALESCE(t.evidencias, '[]'::jsonb) AS evidencias,
            CONCAT(p.nombres, ' ', p.apellidos) AS personal,
            p.cargo AS personal_cargo,
            p.usuario_id AS personal_usuario_id,
            s.nombre AS servicio,
            se.nombre AS sede,
            u.nombre AS creador_nombre
     FROM turnos t
     LEFT JOIN personal p ON t.personal_id = p.id AND p.eliminado = FALSE
     JOIN servicios s ON t.servicio_id = s.id AND s.eliminado = FALSE
     JOIN sedes se ON t.sede_id = se.id AND se.eliminado = FALSE
     LEFT JOIN usuarios u ON t.creado_por = u.id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY p.apellidos, p.nombres, t.fecha`,
    valores
  );
  return rows;
};

const obtenerResumen = async (u) => {
  const fecha=require('../services/evaluacion-operativa').fechaLocal;
  const ts=await listarPorSemana({desde:fecha(new Date(Date.now()-7*86400000)),hasta:fecha(new Date()),usuario:u});
  const cumplidos=ts.filter(t=>t.estado==='cumplido').length;
  return {total:ts.length,programados:ts.filter(t=>t.estado==='programado').length,cumplidos,pendientes:ts.filter(t=>['pendiente','sin_confirmar'].includes(t.estado)||t.relevo_pendiente).length,cobertura:ts.length?Math.round(cumplidos/ts.length*1000)/10:null};
};

const obtenerAlertas = async (u) => {
  const hoy=require('../services/evaluacion-operativa').fechaLocal(new Date());
  const ts=await listarPorSemana({desde:hoy,hasta:hoy,usuario:u});
  return {sin_confirmar:ts.filter(t=>t.estado==='sin_confirmar').length,relevo_pendiente:ts.filter(t=>t.relevo_pendiente).length,pendientes:ts.filter(t=>t.estado==='pendiente').length};
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(
    `SELECT t.*, TO_CHAR(t.fecha, 'YYYY-MM-DD') AS fecha,
            t.hora_inicio, t.hora_fin, t.estado, t.relevo_pendiente,
            t.personal_id, t.servicio_id, t.sede_id, t.creado_por, t.motivo_rechazo,
            COALESCE(t.evidencias, '[]'::jsonb) AS evidencias,
            CONCAT(p.nombres, ' ', p.apellidos) AS personal,
            p.cargo AS personal_cargo,
            p.usuario_id AS personal_usuario_id,
            s.nombre AS servicio,
            se.nombre AS sede,
            u.nombre AS creador_nombre
     FROM turnos t
     LEFT JOIN personal p ON t.personal_id = p.id AND p.eliminado = FALSE
     JOIN servicios s ON t.servicio_id = s.id AND s.eliminado = FALSE
     JOIN sedes se ON t.sede_id = se.id AND se.eliminado = FALSE
     LEFT JOIN usuarios u ON t.creado_por = u.id
     WHERE t.id = $1 AND t.eliminado = FALSE`,
    [id]
  );
  return rows[0] || null;
};

const crear = async ({
  personalId,
  servicioId,
  sedeId,
  fecha,
  horaInicio,
  horaFin,
  estado,
  creadoPor,
}) => {
  const { rows } = await pool.query(
    `INSERT INTO turnos (personal_id, servicio_id, sede_id, fecha, hora_inicio, hora_fin, estado, relevo_pendiente, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8) RETURNING *`,
    [
      personalId,
      servicioId,
      sedeId,
      fecha,
      horaInicio,
      horaFin,
      estado || 'sin_confirmar',
      creadoPor,
    ]
  );
  return rows[0];
};

const verificarSolapamiento = async (datos) => {
  const { inicio, fin } = require('../services/operacion.service').intervalo(
    datos
  );
  const { rows } = await pool.query(
    `SELECT id FROM vw_operacion_turnos WHERE personal_id=$1 AND inicio_programado<$3 AND fin_programado>$2 AND ($4::int IS NULL OR id<>$4)
    UNION ALL SELECT id::int FROM personal_ausencias WHERE personal_id=$1 AND NOT eliminado AND inicio<$3 AND fin>$2`,
    [datos.personalId, inicio, fin, datos.excluirId || null]
  );
  return rows.length > 0;
};

const actualizar = async (
  id,
  { personalId, servicioId, sedeId, fecha, horaInicio, horaFin, estado }
) => {
  const { rows } = await pool.query(
    `UPDATE turnos
     SET personal_id = $1, servicio_id = $2, sede_id = $3, fecha = $4,
         hora_inicio = $5, hora_fin = $6, estado = $7, actualizado_en = NOW()
     WHERE id = $8 AND eliminado = FALSE RETURNING *`,
    [personalId, servicioId, sedeId, fecha, horaInicio, horaFin, estado, id]
  );
  return rows[0] || null;
};

const confirmar = async (id) => {
  const { rows } = await pool.query(
    `UPDATE turnos
     SET estado = 'confirmado', relevo_pendiente = FALSE, actualizado_en = NOW()
     WHERE id = $1 AND eliminado = FALSE RETURNING *`,
    [id]
  );
  return rows[0] || null;
};

const cumplir = async (id, evidencias) => {
  const { rows } = await pool.query(
    `UPDATE turnos
     SET estado = 'cumplido', evidencias = $1::jsonb, evidencias_registradas=jsonb_array_length($1::jsonb), evidencia_registro=NOW(), salida_real=COALESCE(salida_real,NOW()), relevo_pendiente = FALSE, actualizado_en = NOW()
     WHERE id = $2 AND eliminado = FALSE RETURNING *`,
    [JSON.stringify(evidencias), id]
  );
  return rows[0] || null;
};

const rechazar = async (id, motivo) => {
  const { rows } = await pool.query(
    `UPDATE turnos
     SET relevo_pendiente = TRUE, estado = 'sin_confirmar', motivo_rechazo = $1, actualizado_en = NOW()
     WHERE id = $2 AND eliminado = FALSE RETURNING *`,
    [motivo || null, id]
  );
  return rows[0] || null;
};

const reasignar = async (id, { personalId, creadorId }) => {
  const { rows } = await pool.query(
    `UPDATE turnos
     SET personal_id = $1, relevo_pendiente = FALSE, estado = 'sin_confirmar', motivo_rechazo = NULL,
         creado_por = COALESCE($2, creado_por), actualizado_en = NOW()
     WHERE id = $3 AND eliminado = FALSE RETURNING *`,
    [personalId, creadorId || null, id]
  );
  return rows[0] || null;
};

const eliminar = async (id, eliminadoPor) => {
  const { rows } = await pool.query(
    `UPDATE turnos
     SET eliminado = TRUE, eliminado_en = NOW(), eliminado_por = $1, actualizado_en = NOW()
     WHERE id = $2 AND eliminado = FALSE RETURNING id`,
    [eliminadoPor, id]
  );
  return rows[0] || null;
};

const listarSedes = async (u) => {
  const ids=await require('../services/acceso-servicios').serviciosPermitidos(u);
  return (await pool.query('SELECT DISTINCT se.id,se.nombre FROM sedes se JOIN servicios s ON s.sede_id=se.id WHERE NOT se.eliminado AND NOT s.eliminado AND ($1::int[] IS NULL OR s.id=ANY($1)) ORDER BY se.nombre',[ids])).rows;
};

module.exports = {
  listarPorSemana,
  obtenerResumen,
  obtenerAlertas,
  obtenerPorId,
  crear,
  verificarSolapamiento,
  actualizar,
  confirmar,
  cumplir,
  rechazar,
  reasignar,
  eliminar,
  listarSedes,
};

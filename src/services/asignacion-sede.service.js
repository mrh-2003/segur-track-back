'use strict';
const pool = require('../config/db');
const {ErrorAutorizacion, ErrorNoEncontrado, ErrorValidacion} = require('../utils/errores');
const {comprobarPersonal} = require('./acceso-servicios');

module.exports.sedesAsignables = async usuario => {
 const {rows}=await pool.query(`SELECT s.id,s.nombre FROM sedes s WHERE NOT s.eliminado AND (
  $2::text IN ('administrador','jefe_operaciones') OR EXISTS(
   SELECT 1 FROM personal sup WHERE sup.usuario_id=$1 AND sup.cargo='supervisor' AND NOT sup.eliminado AND (
    EXISTS(SELECT 1 FROM personal_sedes ps WHERE ps.personal_id=sup.id AND ps.sede_id=s.id)
    OR s.supervisor_id=sup.id
    OR EXISTS(SELECT 1 FROM servicios srv WHERE srv.sede_id=s.id AND srv.supervisor_id=sup.id AND NOT srv.eliminado)))) ORDER BY s.nombre`,[usuario.id,usuario.rol]);
 return rows;
};

// Una operación específica evita conceder al supervisor edición de cargos o cuentas.
module.exports.cambiar = async (id, sedeId, usuario) => {
 const c=await pool.connect();
 try {
  await c.query('BEGIN');
  const p=(await c.query('SELECT * FROM personal WHERE id=$1 AND NOT eliminado FOR UPDATE',[id])).rows[0];
  if(!p)throw new ErrorNoEncontrado('Agente no encontrado');
  if(p.cargo!=='agente')throw new ErrorValidacion('Esta acción solo permite cambiar la sede de un agente');
  if(!(await c.query('SELECT 1 FROM sedes WHERE id=$1 AND NOT eliminado',[sedeId])).rowCount)throw new ErrorValidacion('Seleccione una sede vigente');
  if(usuario.rol==='supervisor'){
   await comprobarPersonal(id,usuario,c);
   if(!(await c.query(`SELECT 1 FROM personal sup WHERE sup.usuario_id=$1 AND sup.cargo='supervisor' AND NOT sup.eliminado AND (
    EXISTS(SELECT 1 FROM personal_sedes ps WHERE ps.personal_id=sup.id AND ps.sede_id=$2)
    OR EXISTS(SELECT 1 FROM servicios s WHERE s.supervisor_id=sup.id AND s.sede_id=$2 AND NOT s.eliminado)
    OR EXISTS(SELECT 1 FROM sedes s WHERE s.supervisor_id=sup.id AND s.id=$2 AND NOT s.eliminado))`,[usuario.id,sedeId])).rowCount)
    throw new ErrorAutorizacion('Solo puede trasladar agentes entre sus sedes asignadas o las de sus servicios');
  }
  await c.query('UPDATE personal SET sede_id=$2,actualizado_en=NOW() WHERE id=$1',[id,sedeId]);
  await c.query('DELETE FROM personal_sedes WHERE personal_id=$1',[id]);
  await c.query('INSERT INTO personal_sedes VALUES($1,$2)',[id,sedeId]);
  await c.query(`INSERT INTO actividad_reciente(tipo,descripcion,usuario_id) VALUES('personal_sede_actualizada',$1,$2)`,[`Sede del agente ${p.nombres} ${p.apellidos} actualizada`,usuario.id]);
  await c.query('COMMIT');
  return {id,sede_id:sedeId,sede_ids:[sedeId]};
 } catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
};

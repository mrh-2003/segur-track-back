'use strict';
const pool = require('../config/db');
module.exports = async (usuarioId, motivo, tarea) => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(
      "SELECT set_config('app.usuario_id',$1,true),set_config('app.motivo',$2,true)",
      [String(usuarioId), motivo || 'Actualización operativa']
    );
    const result = await tarea(c);
    await c.query(
      'INSERT INTO actividad_reciente(tipo,descripcion,usuario_id) VALUES($1,$2,$3)',
      ['operacion_actualizada', motivo || 'Actualización operativa', usuarioId]
    );
    await c.query('COMMIT');
    return result;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
};

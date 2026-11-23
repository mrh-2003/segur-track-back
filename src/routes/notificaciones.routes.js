'use strict';
const router=require('express').Router();
const pool=require('../config/db');
const {respuestaExito}=require('../utils/respuesta');
router.get('/',async(req,res,next)=>{try{
 const datos=(await pool.query("SELECT n.*,TO_CHAR(t.fecha,'YYYY-MM-DD') fecha FROM notificaciones n LEFT JOIN turnos t ON t.id=n.turno_id WHERE n.usuario_id=$1 ORDER BY n.creado_en DESC,n.id DESC LIMIT 50",[req.usuario.id])).rows;
 respuestaExito(res,datos);
}catch(e){next(e);}});
router.param('id',require('../middlewares/identificador'));
router.patch('/:id/leer',async(req,res,next)=>{try{
 const r=(await pool.query('UPDATE notificaciones SET leido_en=COALESCE(leido_en,NOW()) WHERE id=$1 AND usuario_id=$2 RETURNING *',[req.params.id,req.usuario.id])).rows[0];
 if(!r)throw new (require('../utils/errores').ErrorNoEncontrado)('Notificación no encontrada');
 respuestaExito(res,r);
}catch(e){next(e);}});
module.exports=router;

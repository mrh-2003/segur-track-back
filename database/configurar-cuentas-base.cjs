'use strict';
// Operación explícita; no cambia contraseñas al iniciar la aplicación.
const pool=require('../src/config/db'),bcrypt=require('bcryptjs');
const cuentas=[['admin@segurtrack.com','administrador'],['supervisor@segurtrack.com','supervisor'],['jefe@segurtrack.com','jefe_operaciones'],['operador@segurtrack.com','operador']];
(async()=>{
 if(!process.argv.includes('--aplicar'))throw new Error('Use --aplicar para configurar las cuatro cuentas base existentes.');
 const clave=process.env.CUENTAS_BASE_CLAVE;
 if(!clave||clave.length<8)throw new Error('Defina CUENTAS_BASE_CLAVE con la contraseña solicitada.');
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const seleccionadas=[];
  for(const [correo,rol] of cuentas){
   const u=(await c.query('SELECT id FROM usuarios WHERE lower(btrim(correo))=$1 AND NOT eliminado FOR UPDATE',[correo])).rows[0];
   if(!u)throw new Error('No existe la cuenta requerida: '+correo);
   const perfil=(await c.query('SELECT id,cargo,sede_id FROM personal WHERE usuario_id=$1 AND NOT eliminado FOR UPDATE',[u.id])).rows[0];
   const cargo=rol==='operador'?'agente':rol;
   if(perfil&&perfil.cargo!==cargo)throw new Error('El perfil no corresponde al rol solicitado: '+correo);
   if(['supervisor','operador'].includes(rol)){
    if(!perfil)throw new Error('Falta el perfil operativo de '+correo);
    const sedes=(await c.query('SELECT ps.sede_id FROM personal_sedes ps JOIN sedes s ON s.id=ps.sede_id AND NOT s.eliminado WHERE ps.personal_id=$1',[perfil.id])).rows;
    if(!sedes.length||(rol==='operador'&&(sedes.length!==1||sedes[0].sede_id!==perfil.sede_id)))throw new Error('Revise las sedes del perfil de '+correo);
   }
   seleccionadas.push({id:u.id,correo,rol,perfilId:perfil?.id});
  }
  for(const u of seleccionadas){
   const hash=await bcrypt.hash(clave,10);
   await c.query('UPDATE usuarios SET clave_hash=$2,rol=$3,activo=TRUE,debe_cambiar_clave=FALSE,actualizado_en=NOW() WHERE id=$1',[u.id,hash,u.rol]);
   if(u.perfilId)await c.query("UPDATE personal SET estado='activo',actualizado_en=NOW() WHERE id=$1",[u.perfilId]);
  }
  await c.query('SET CONSTRAINTS ALL IMMEDIATE');
  await c.query('COMMIT');
  for(const [correo,rol] of cuentas){
   const r=await require('../src/services/auth.service').login({correo,clave});
   if(r.usuario.rol!==rol||r.usuario.debeCambiarClave)throw new Error('No se validó el acceso de '+correo);
  }
  console.log(JSON.stringify({cuentas:cuentas.map(([correo,rol])=>({correo,rol,accesoVerificado:true})),asignacionesConservadas:true},null,2));
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});

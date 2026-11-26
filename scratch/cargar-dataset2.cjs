'use strict';
// Carga aditiva, reproducible por huella del XLSX, con ensayo transaccional.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),bcrypt=require('bcryptjs');
const pool=require('../src/config/db');
const dir=path.resolve(__dirname,'../../outputs/auditoria_dataset');
const fuente='C:/Users/HuberWayra/Downloads/SegurTrack_Dataset_2.xlsx';
const datos=JSON.parse(fs.readFileSync(path.join(dir,'dataset.json'),'utf8'));
const maps={},normal=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const fecha=v=>v?String(v).replace(' ','T')+'-05:00':null;
const porId=Object.fromEntries(Object.entries(datos).map(([k,rr])=>[k,new Map(rr.map(r=>[r.id,r]))]));
const reglas={version:1,fuente:'Dataset sintético, no datos reales',usuarios:'habilitados, contraseña inicial igual a correo; cambio obligatorio',documentos:'identificadores sintéticos numéricos únicos; originales conservados',sedes:'agentes según turnos; supervisores todas sus sedes de servicio',servicios:'en_curso, fecha_fin NULL por solicitud del usuario',cancelados:'466 excluidos; fuente íntegra archivada',vacantes:'691 sin personal, incidencia conserva responsable operativo original',asistencia:'marcaciones del dataset validadas para simulación',evidencias:'solo declaraciones registradas, sin archivos inventados; revisión pendiente',protocolos:'declaración fuente en conforme, revisión pendiente; no se inventa aprobación',sla:'atención según fuente; resolución asumida desde configuración vigente, identificada en origen_plazo y observación',planes:'no se inventan actividades, rondas, consignas ni reportes; plan_kpi_validado FALSE',criterios:'se conserva modelo vigente; configuración antigua solo en archivo fuente'};
async function insertar(c,tabla,rows){
 if(!rows.length)return;
 const cols=Object.keys(rows[0]),seleccion=cols.map(x=>'x."'+x+'"').join(',');
 for(let i=0;i<rows.length;i+=1500)await c.query(`INSERT INTO ${tabla}(${cols.map(x=>'"'+x+'"').join(',')}) SELECT ${seleccion} FROM jsonb_populate_recordset(NULL::${tabla},$1::jsonb) x`,[JSON.stringify(rows.slice(i,i+1500))]);
 console.log(tabla+': '+rows.length);
}
async function ids(c,tabla,rr,key='id'){
 const existentes=new Set((await c.query(`SELECT id FROM ${tabla}`)).rows.map(r=>r.id));
 const result=new Map();
 while(result.size<rr.length){
  const nn=rr.length-result.size;
  const batch=(await c.query(`SELECT nextval(pg_get_serial_sequence($1,'id'))::int id FROM generate_series(1,$2::int)`,[tabla,nn])).rows;
  for(const r of batch)if(!existentes.has(r.id))result.set(rr[result.size][key],r.id);
 }
 maps[tabla]=result;return result;
}
async function huellas(c,base){
 const salida={};for(const [t,ids]of Object.entries(base))salida[t]=(await c.query(`SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text,'')) hash FROM ${t} x WHERE id=ANY($1::int[])`,[ids])).rows[0].hash;
 return salida;
}
async function auditar(c,turnosIds,incIds,personasIds,serviciosIds){
 const checks={};
 const consultas={
  turnos_sede_servicio:`SELECT count(*) n FROM turnos t JOIN servicios s ON s.id=t.servicio_id WHERE t.id=ANY($1) AND t.sede_id<>s.sede_id`,
  turnos_sede_agente:`SELECT count(*) n FROM turnos t JOIN personal p ON p.id=t.personal_id WHERE t.id=ANY($1) AND t.sede_id<>p.sede_id`,
  turnos_sin_vinculo_servicio:`SELECT count(*) n FROM turnos t WHERE t.id=ANY($1) AND t.personal_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM servicio_personal sp WHERE sp.personal_id=t.personal_id AND sp.servicio_id=t.servicio_id AND NOT sp.eliminado)`,
  solapamientos:`SELECT count(*) n FROM vw_operacion_turnos a JOIN vw_operacion_turnos b ON a.personal_id=b.personal_id AND a.id<b.id AND a.inicio_programado<b.fin_programado AND a.fin_programado>b.inicio_programado WHERE a.id=ANY($1)`,
  asistencia_incoherente:`SELECT count(*) n FROM turnos WHERE id=ANY($1) AND (NOT asistencia_validada OR (estado='cumplido' AND (ingreso_real IS NULL OR salida_real IS NULL)) OR (personal_id IS NULL AND (ingreso_real IS NOT NULL OR salida_real IS NOT NULL)))`,
  historial_turnos:`SELECT count(*) n FROM turnos t WHERE t.id=ANY($1) AND NOT EXISTS(SELECT 1 FROM turnos_historial h WHERE h.turno_id=t.id)`
 };
 for(const [k,sql]of Object.entries(consultas)){checks[k]=Number((await c.query(sql,[turnosIds])).rows[0].n);assert.equal(checks[k],0,k);}
 checks.incidencias_incoherentes=Number((await c.query(`SELECT count(*) n FROM incidencias i LEFT JOIN turnos t ON t.id=i.turno_id WHERE i.id=ANY($1) AND (t.id IS NULL OR i.servicio_id<>t.servicio_id OR i.personal_id IS DISTINCT FROM t.personal_id OR i.fecha_atencion<i.fecha_registro OR i.fecha_cierre<i.fecha_atencion OR i.sla_min IS NULL OR i.sla_resolucion_min IS NULL OR NOT EXISTS(SELECT 1 FROM servicio_personal sp WHERE sp.personal_id=i.responsable_id AND sp.servicio_id=i.servicio_id AND NOT sp.eliminado))`,[incIds])).rows[0].n);assert.equal(checks.incidencias_incoherentes,0);
 checks.cuentas_sin_coherencia=Number((await c.query(`SELECT count(*) n FROM personal p JOIN usuarios u ON u.id=p.usuario_id WHERE p.id=ANY($1) AND (NOT u.activo OR NOT u.debe_cambiar_clave OR p.correo<>u.correo OR (p.cargo='agente' AND u.rol<>'operador') OR (p.cargo='supervisor' AND u.rol<>'supervisor'))`,[personasIds])).rows[0].n);assert.equal(checks.cuentas_sin_coherencia,0);
 checks.supervisores_sin_sede=Number((await c.query(`SELECT count(*) n FROM servicios s WHERE s.id=ANY($1) AND NOT EXISTS(SELECT 1 FROM personal_sedes ps WHERE ps.personal_id=s.supervisor_id AND ps.sede_id=s.sede_id)`,[serviciosIds])).rows[0].n);assert.equal(checks.supervisores_sin_sede,0);
 checks.evidencias_sin_coherencia=Number((await c.query(`SELECT count(*) n FROM evidencias_servicio e JOIN turnos t ON t.id=e.turno_id WHERE t.id=ANY($1) AND (e.servicio_id<>t.servicio_id OR e.personal_id IS DISTINCT FROM t.personal_id)`,[turnosIds])).rows[0].n);assert.equal(checks.evidencias_sin_coherencia,0);
 await c.query('SET CONSTRAINTS ALL IMMEDIATE');
 return checks;
}
(async()=>{
 const aplicar=process.argv.includes('--aplicar');const c=await pool.connect();let resultado;
 try{
  await c.query('BEGIN');await c.query("SET LOCAL TIME ZONE 'America/Lima'");await c.query("SET LOCAL lock_timeout='10s'");await c.query("SET LOCAL statement_timeout='180s'");await c.query('SELECT pg_advisory_xact_lock(741120)');
  const archivo=fs.readFileSync(fuente),huella=crypto.createHash('sha256').update(archivo).digest('hex');
  const previo=(await c.query('SELECT id,estado,resultado FROM importaciones WHERE huella=$1',[huella])).rows[0];
  if(previo){assert.equal(previo.estado,'importado');await c.query('ROLLBACK');console.log(JSON.stringify({ya_importado:true,...previo}));return;}
  const protegidos={};for(const t of ['usuarios','clientes','sedes','personal','servicios','turnos','incidencias','tipos_incidencia','criterios_mcda'])protegidos[t]=(await c.query(`SELECT id FROM ${t}`)).rows.map(r=>r.id);
  const antes=await huellas(c,protegidos);
  const migracion='021_prioridad_critica.sql';
  if(!(await c.query('SELECT 1 FROM migraciones_aplicadas WHERE nombre=$1',[migracion])).rowCount){await c.query(fs.readFileSync(path.resolve(__dirname,'../database/migrations',migracion),'utf8'));await c.query('INSERT INTO migraciones_aplicadas(nombre) VALUES($1)',[migracion]);}
  const actor=(await c.query("SELECT id FROM usuarios WHERE rol='administrador' AND activo AND NOT eliminado ORDER BY id LIMIT 1")).rows[0].id;
  await c.query("SELECT set_config('app.usuario_id',$1,true),set_config('app.motivo','Carga auditada del dataset sintético 2; fuente y equivalencias en importaciones',true)",[String(actor)]);
  const existentes=(await c.query('SELECT correo FROM usuarios WHERE NOT eliminado')).rows.map(r=>normal(r.correo));assert.ok(datos.usuarios.every(u=>!existentes.includes(normal(u.correo))),'Correo existente; revisar equivalencia antes de cargar');
  await ids(c,'usuarios',datos.usuarios);await ids(c,'clientes',datos.clientes);await ids(c,'sedes',datos.sedes);await ids(c,'personal',datos.personal);await ids(c,'servicios',datos.servicios);
  const usuarios=[];for(const r of datos.usuarios)usuarios.push({id:maps.usuarios.get(r.id),nombre:r.nombre,correo:r.correo.toLowerCase(),clave_hash:await bcrypt.hash(r.correo.toLowerCase(),10),rol:({Administrador:'administrador','Jefe de operaciones':'jefe_operaciones',Supervisor:'supervisor',Agente:'operador'})[r.rol],activo:true,debe_cambiar_clave:true});
  await insertar(c,'usuarios',usuarios);
  await insertar(c,'clientes',datos.clientes.map(r=>({id:maps.clientes.get(r.id),nombre:r.razon_social,contacto:r.contacto})));
  await insertar(c,'sedes',datos.sedes.map(r=>({id:maps.sedes.get(r.id),nombre:r.nombre,cliente_id:maps.clientes.get(r.cliente_id)})));
  const turnosFuente=datos.turnos.filter(t=>t.estado!=='Cancelado'),sedesAgente=new Map();
  for(const t of turnosFuente){if(!sedesAgente.has(t.personal_id))sedesAgente.set(t.personal_id,new Set());sedesAgente.get(t.personal_id).add(t.sede_id);}
  assert.ok([...sedesAgente.values()].every(s=>s.size===1),'Un agente tiene múltiples sedes operativas');
  const docOcupados=new Set((await c.query('SELECT documento FROM personal')).rows.map(r=>r.documento));let doc=90000000;
  const docs={};const personas=datos.personal.map(r=>{while(docOcupados.has(String(doc)))doc++;const documento=String(doc++);docOcupados.add(documento);docs[r.documento]=documento;const partes=r.nombre.trim().split(/\s+/);assert.ok(partes.length>=3);return {id:maps.personal.get(r.id),nombres:partes.slice(0,-2).join(' '),apellidos:partes.slice(-2).join(' '),documento,cargo:normal(r.cargo),estado:'activo',correo:porId.usuarios.get(r.usuario_id).correo.toLowerCase(),usuario_id:maps.usuarios.get(r.usuario_id),sede_id:maps.sedes.get(r.cargo==='Agente'?[...sedesAgente.get(r.id)][0]:r.sede_id)};});
  await insertar(c,'personal',personas);
  const supSedes=[...new Set(datos.servicios.map(s=>s.supervisor_id+'|'+s.sede_id))].map(k=>{const[p,s]=k.split('|').map(Number);return {personal_id:maps.personal.get(p),sede_id:maps.sedes.get(s)};});
  await c.query(`INSERT INTO personal_sedes SELECT x.personal_id,x.sede_id FROM jsonb_to_recordset($1) x(personal_id int,sede_id int) ON CONFLICT DO NOTHING`,[JSON.stringify(supSedes)]);
  await c.query(`UPDATE sedes se SET supervisor_id=x.supervisor_id FROM jsonb_to_recordset($1) x(id int,supervisor_id int) WHERE se.id=x.id`,[JSON.stringify(datos.sedes.map(s=>({id:maps.sedes.get(s.id),supervisor_id:maps.personal.get(datos.servicios.find(v=>v.sede_id===s.id).supervisor_id)})))]);
  const servicios=datos.servicios.map(r=>{const ts=turnosFuente.filter(t=>t.servicio_id===r.id),horas=[...new Set(ts.map(t=>t.inicio_programado.slice(11,19)+'|'+t.fin_programado.slice(11,19)))];assert.equal(horas.length,1,'Horario de servicio ambiguo');const[hi,hf]=horas[0].split('|');return{id:maps.servicios.get(r.id),nombre:r.nombre,codigo_externo:'DS2-SRV-'+String(r.id).padStart(3,'0'),cliente_id:maps.clientes.get(r.cliente_id),sede_id:maps.sedes.get(r.sede_id),supervisor_id:maps.personal.get(r.supervisor_id),hora_inicio:hi,hora_fin:hf,fecha_inicio:r.fecha_inicio,fecha_fin:null,estado:'en_curso'};});
  await insertar(c,'servicios',servicios);
  const vinculos=[...new Set(turnosFuente.map(t=>t.servicio_id+'|'+t.personal_id))].map(k=>{const[s,p]=k.split('|').map(Number);return{servicio_id:maps.servicios.get(s),personal_id:maps.personal.get(p)};});await insertar(c,'servicio_personal',vinculos);
  maps.tipos_incidencia=new Map();
  const sinonimos={'Tardanza':'Llegada tardía','Inasistencia':'Ausencia de personal','Falla de equipamiento':'Falla de equipo'};
  for(const r of datos.tipos_incidencia){const nombre=sinonimos[r.nombre]||r.nombre;let tipo=(await c.query('SELECT id FROM tipos_incidencia WHERE lower(nombre)=lower($1) AND NOT eliminado',[nombre])).rows[0];if(!tipo)tipo=(await c.query('INSERT INTO tipos_incidencia(nombre) VALUES($1) RETURNING id',[nombre])).rows[0];maps.tipos_incidencia.set(r.id,tipo.id);}
  await ids(c,'turnos',turnosFuente);
  const evidenciasPorTurno=new Map();for(const e of datos.evidencias_demo){if(!evidenciasPorTurno.has(e.turno_id))evidenciasPorTurno.set(e.turno_id,[]);evidenciasPorTurno.get(e.turno_id).push(e);}
  const turnos=turnosFuente.map(r=>{const ee=evidenciasPorTurno.get(r.id)||[],registradas=ee.filter(e=>e.estado==='Registrada');return{id:maps.turnos.get(r.id),servicio_id:maps.servicios.get(r.servicio_id),sede_id:maps.sedes.get(r.sede_id),personal_id:r.estado==='No cubierto'?null:maps.personal.get(r.personal_id),fecha:r.fecha,hora_inicio:r.inicio_programado.slice(11,19),hora_fin:r.fin_programado.slice(11,19),ingreso_real:fecha(r.inicio_real),salida_real:fecha(r.fin_real),estado:r.estado==='Completado'?'cumplido':r.estado==='Incompleto'?'pendiente':'sin_confirmar',relevo_pendiente:r.estado==='No cubierto',creado_por:actor,puesto:porId.servicios.get(r.servicio_id).nombre,funcion:porId.servicios.get(r.servicio_id).modalidad,asistencia_validada:true,tolerancia_min:10,evidencias_requeridas:ee.length,evidencias_registradas:registradas.length,evidencia_limite:fecha(r.fin_programado),evidencia_registro:registradas.length?fecha(registradas.map(e=>e.fecha_registro).sort().at(-1)):null,clave_importacion:'DS2-TUR-'+r.id,plan_kpi_validado:false};});
  await insertar(c,'turnos',turnos);
  const cfg=(await c.query('SELECT * FROM configuracion_operativa WHERE id=1')).rows[0];await ids(c,'incidencias',datos.incidencias);
  const incidencias=datos.incidencias.map(r=>{const t=porId.turnos.get(r.turno_id),prioridad=normal(r.prioridad);assert.ok(maps.turnos.has(t.id),'Incidencia de turno cancelado');return{id:maps.incidencias.get(r.id),codigo:'D2-'+String(r.id).padStart(6,'0'),tipo_incidencia_id:maps.tipos_incidencia.get(r.tipo_id),servicio_id:maps.servicios.get(r.servicio_id),turno_id:maps.turnos.get(r.turno_id),personal_id:t.estado==='No cubierto'?null:maps.personal.get(r.personal_id),responsable_id:maps.personal.get(r.personal_id),descripcion:r.descripcion,prioridad,estado:'cerrada',fecha_registro:fecha(r.fecha_reporte),fecha_atencion:fecha(r.fecha_atencion),fecha_cierre:fecha(r.fecha_cierre),sla_min:r.sla_minutos,sla_resolucion_min:cfg['resolucion_'+prioridad],origen_plazo:'adaptacion_dataset2_configuracion',observacion:'Dataset sintético 2. SLA de atención original. SLA de resolución asumido de configuración vigente al importar; no consta en fuente.',registrado_por:actor};});
  await insertar(c,'incidencias',incidencias);
  const seguimiento=[];for(const i of incidencias)for(const[accion,campo,texto]of [['registrar','fecha_registro','Registro declarado'],['atender','fecha_atencion','Atención declarada'],['resolver','fecha_cierre','Cierre declarado']])seguimiento.push({incidencia_id:i.id,accion,comentario:texto+' en Dataset sintético 2; historial migrado, actor original no informado.',usuario_id:actor,creado_en:i[campo]});await insertar(c,'incidencias_seguimiento',seguimiento);
  const nombresProtocolos=[...new Set(datos.protocolos_demo.map(p=>p.protocolo))];const protocolos=nombresProtocolos.map((nombre,i)=>({id:i+1,nombre}));await ids(c,'protocolos',protocolos);
  await insertar(c,'protocolos',protocolos.map(p=>({id:maps.protocolos.get(p.id),codigo:'DS2-PRO-'+p.id,nombre:p.nombre,descripcion:'Catálogo procedente del dataset sintético 2.'})));
  const codigoProtocolo=new Map(protocolos.map(p=>[p.nombre,maps.protocolos.get(p.id)]));
  await insertar(c,'servicio_protocolos',servicios.flatMap(s=>protocolos.map(p=>({servicio_id:s.id,protocolo_id:maps.protocolos.get(p.id)}))));
  const evidencias=[];
  for(const p of datos.protocolos_demo){const t=porId.turnos.get(p.turno_id);if(t.estado==='No cubierto')continue;assert.ok(maps.turnos.has(t.id));evidencias.push({servicio_id:maps.servicios.get(t.servicio_id),turno_id:maps.turnos.get(t.id),personal_id:maps.personal.get(t.personal_id),protocolo_id:codigoProtocolo.get(p.protocolo),titulo:p.protocolo,descripcion:`Dataset2 protocolos_demo id=${p.id}; estado fuente=${p.estado}. Declaración sintética sin soporte adjunto.`,estado_revision:'pendiente',conforme:p.estado==='Cumplido'?true:null,creado_en:p.fecha_registro?fecha(p.fecha_registro):new Date().toISOString(),observacion:p.fecha_registro?null:'Pendiente en fuente; fecha de creación corresponde a importación, no a ejecución histórica.'});}
  for(const e of datos.evidencias_demo){if(e.estado!=='Registrada')continue;const t=porId.turnos.get(e.turno_id);assert.ok(t.estado!=='No cubierto');evidencias.push({servicio_id:maps.servicios.get(t.servicio_id),turno_id:maps.turnos.get(t.id),personal_id:maps.personal.get(t.personal_id),protocolo_id:null,titulo:'Registro de '+e.tipo.toLowerCase(),descripcion:`Dataset2 evidencias_demo id=${e.id}; registro declarado sin archivo adjunto.`,estado_revision:'pendiente',conforme:null,creado_en:fecha(e.fecha_registro),observacion:'Sin fotografía en archivo fuente; pendiente de revisión.'});}
  await insertar(c,'evidencias_servicio',evidencias);
  await insertar(c,'actividad_reciente',[{tipo:'importacion_dataset',descripcion:'Integración auditada Dataset 2: 102 cuentas, 100 personas, 40 servicios, 22.676 turnos y 3.913 incidencias. Fuente sintética y equivalencias archivadas.',usuario_id:actor}]);
  const checks=await auditar(c,turnos.map(t=>t.id),incidencias.map(i=>i.id),personas.map(p=>p.id),servicios.map(s=>s.id));assert.deepEqual(await huellas(c,protegidos),antes,'La carga modificó registros anteriores');
  for(const u of usuarios)assert.ok(await bcrypt.compare(u.correo,u.clave_hash),'Contraseña inicial incorrecta');
  resultado={usuarios:usuarios.length,clientes:datos.clientes.length,sedes:datos.sedes.length,personal:personas.length,servicios:servicios.length,turnos:turnos.length,vacantes:turnos.filter(t=>t.personal_id===null).length,cancelados_excluidos:datos.turnos.length-turnos.length,incidencias:incidencias.length,incidencias_criticas:incidencias.filter(i=>i.prioridad==='critica').length,protocolos:protocolos.length,evidencias_servicio:evidencias.length,protocolos_vacantes_archivados:datos.protocolos_demo.filter(p=>porId.turnos.get(p.turno_id).estado==='No cubierto').length,seguimientos:seguimiento.length,checks,registros_previos_intactos:true};
  const equivalencias=Object.fromEntries(Object.entries(maps).map(([t,m])=>[t,Object.fromEntries(m)]));equivalencias.documentos=docs;
  const lote=(await c.query(`INSERT INTO importaciones(huella,nombre,usuario_id,datos,archivo,resultado,estado) VALUES($1,$2,$3,$4,$5,$6,'importado') RETURNING id`,[huella,'SegurTrack_Dataset_2.xlsx',actor,JSON.stringify({origen:'carga_auditada_dataset2',reglas,equivalencias,advertencias:['Actividades, rondas, consignas y reportes operativos no informados en la fuente.','Protocolos y evidencias importados pendientes de revisión, sin fotos ficticias.']}),archivo,JSON.stringify(resultado)])).rows[0].id;
  await c.query(`INSERT INTO importacion_filas(importacion_id,fila,turno_id) SELECT $1,x.fila,x.turno_id FROM jsonb_to_recordset($2) x(fila int,turno_id int)`,[lote,JSON.stringify(turnosFuente.map(t=>({fila:t.id+1,turno_id:maps.turnos.get(t.id)})))]);
  if(aplicar)await require('./verificar-dataset2.cjs')(c);
  if(aplicar)await c.query('COMMIT');else await c.query('ROLLBACK');
  fs.writeFileSync(path.join(dir,aplicar?'carga-aplicada.json':'ensayo.json'),JSON.stringify({modo:aplicar?'aplicado':'ensayo con rollback',lote,huella,reglas,resultado,equivalencias},null,2));
  console.log(JSON.stringify({modo:aplicar?'aplicado':'ensayo con rollback',lote,resultado},null,2));
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(()=>pool.end());

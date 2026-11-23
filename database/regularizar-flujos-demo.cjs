'use strict';
// Solo registros sintéticos identificados por servicio y marcadores DEMO.
// La transacción pertenece al llamador; no modifica registros de servicios reales.
async function preparar(c){
 if(!(await c.query('SELECT datos_demo FROM configuracion_operativa WHERE id=1')).rows[0]?.datos_demo)throw new Error('Se requiere una base identificada como demostración');
 await c.query(`CREATE OR REPLACE TEMP VIEW flujo_demo_turnos AS
  SELECT t.*,v.inicio_programado,v.fin_programado FROM turnos t JOIN servicios s ON s.id=t.servicio_id
  JOIN vw_operacion_turnos v ON v.id=t.id WHERE NOT t.eliminado AND NOT s.eliminado AND s.codigo_externo LIKE 'DEMO-SRV-%'`);
 await c.query(`CREATE OR REPLACE TEMP VIEW flujo_demo_incidencias AS
  SELECT i.* FROM incidencias i JOIN servicios s ON s.id=i.servicio_id WHERE NOT i.eliminado AND NOT s.eliminado
  AND s.codigo_externo LIKE 'DEMO-SRV-%' AND (i.origen_plazo LIKE 'demo%' OR i.descripcion LIKE '%Caso de demostración%' OR i.descripcion LIKE 'DEMO%')`);
}
async function auditar(c){
 await preparar(c);
 const r=(await c.query(`SELECT
  (SELECT COUNT(*) FROM flujo_demo_turnos WHERE estado='cumplido' AND (personal_id IS NULL OR ingreso_real IS NULL OR salida_real IS NULL)) finalizados_sin_asistencia,
  (SELECT COUNT(*) FROM flujo_demo_turnos WHERE inicio_programado>NOW() AND (ingreso_real IS NOT NULL OR salida_real IS NOT NULL OR estado='cumplido')) futuros_ejecutados,
  (SELECT COUNT(*) FROM flujo_demo_turnos WHERE ingreso_real>NOW() OR ingreso_real>=fin_programado OR salida_real>NOW() OR salida_real<=ingreso_real OR (salida_real IS NOT NULL AND ingreso_real IS NULL)) marcaciones_invalidas,
  (SELECT COUNT(*) FROM flujo_demo_turnos WHERE estado='cumplido' AND (jsonb_array_length(COALESCE(evidencias,'[]'::jsonb))<COALESCE(evidencias_requeridas,1) OR evidencias_registradas IS DISTINCT FROM jsonb_array_length(COALESCE(evidencias,'[]'::jsonb)))) evidencias_finales_incompletas,
  (SELECT COUNT(*) FROM flujo_demo_turnos t WHERE t.personal_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM servicio_personal sp WHERE sp.servicio_id=t.servicio_id AND sp.personal_id=t.personal_id AND NOT sp.eliminado)) personal_sin_vinculo,
  (SELECT COUNT(*) FROM obligaciones_operativas o JOIN flujo_demo_turnos t ON t.id=o.turno_id WHERE NOT o.eliminado AND o.fecha_completada IS NOT NULL AND (t.ingreso_real IS NULL OR o.fecha_completada<GREATEST(t.ingreso_real,t.inicio_programado) OR o.fecha_completada>COALESCE(t.salida_real,NOW()) OR o.fecha_completada>NOW())) obligaciones_fuera_de_secuencia,
  (SELECT COUNT(*) FROM rondas o JOIN flujo_demo_turnos t ON t.id=o.turno_id WHERE NOT o.eliminado AND o.fecha_completada IS NOT NULL AND (t.ingreso_real IS NULL OR o.fecha_completada<GREATEST(t.ingreso_real,t.inicio_programado) OR o.fecha_completada>COALESCE(t.salida_real,NOW()) OR o.fecha_completada>NOW())) rondas_fuera_de_secuencia,
  (SELECT COUNT(*) FROM verificaciones_consignas o JOIN flujo_demo_turnos t ON t.id=o.turno_id WHERE t.ingreso_real IS NULL OR o.creado_en<GREATEST(t.ingreso_real,t.inicio_programado) OR o.creado_en>COALESCE(t.salida_real,NOW()) OR o.creado_en>NOW()) consignas_fuera_de_secuencia,
  (SELECT COUNT(*) FROM obligaciones_operativas o JOIN flujo_demo_turnos t ON t.id=o.turno_id WHERE NOT o.eliminado AND o.tipo='reporte' AND o.estado_revision<>'pendiente' AND (o.fecha_completada IS NULL OR o.revisado_por IS NULL OR o.fecha_revision<o.fecha_completada OR o.fecha_revision>NOW())) revision_sin_entrega,
  (SELECT COUNT(*) FROM flujo_demo_incidencias i LEFT JOIN flujo_demo_turnos t ON t.id=i.turno_id LEFT JOIN personal p ON p.id=i.responsable_id LEFT JOIN usuarios u ON u.id=p.usuario_id
   WHERE t.id IS NULL OR t.personal_id IS DISTINCT FROM i.responsable_id OR t.servicio_id<>i.servicio_id OR t.ingreso_real IS NULL OR p.cargo IS DISTINCT FROM 'agente' OR u.rol IS DISTINCT FROM 'operador' OR i.registrado_por IS DISTINCT FROM p.usuario_id
   OR i.fecha_registro<GREATEST(t.inicio_programado,t.ingreso_real) OR i.fecha_registro>=t.fin_programado OR i.fecha_registro>NOW()) incidencias_sin_turno_activo,
  (SELECT COUNT(*) FROM flujo_demo_incidencias i WHERE (i.estado<>'abierta' AND (i.fecha_atencion IS NULL OR i.fecha_atencion<i.fecha_registro OR i.fecha_atencion>NOW()))
   OR (i.estado='cerrada' AND (i.fecha_cierre IS NULL OR i.fecha_cierre<i.fecha_atencion OR i.fecha_cierre>NOW() OR jsonb_array_length(i.evidencias)=0))
   OR NOT EXISTS(SELECT 1 FROM incidencias_seguimiento e WHERE e.incidencia_id=i.id AND e.accion='registrar')
   OR (i.estado<>'abierta' AND NOT EXISTS(SELECT 1 FROM incidencias_seguimiento e WHERE e.incidencia_id=i.id AND e.accion='atender'))
   OR (i.estado='cerrada' AND NOT EXISTS(SELECT 1 FROM incidencias_seguimiento e WHERE e.incidencia_id=i.id AND e.accion='resolver'))) incidencias_sin_etapas,
  (SELECT COUNT(*) FROM incidencias_ampliaciones a JOIN flujo_demo_incidencias i ON i.id=a.incidencia_id JOIN usuarios u ON u.id=a.solicitado_por LEFT JOIN usuarios d ON d.id=a.decidido_por
   WHERE u.rol<>'supervisor' OR a.solicitado_en<COALESCE(i.fecha_atencion,i.fecha_registro) OR a.solicitado_en>NOW()
   OR (a.estado IN ('aprobada','rechazada') AND (d.rol IS DISTINCT FROM 'jefe_operaciones' OR a.decidido_en<a.solicitado_en OR a.decidido_en>NOW()))
   OR NOT EXISTS(SELECT 1 FROM incidencias_seguimiento e WHERE e.incidencia_id=i.id AND e.accion='solicitar_ampliacion')
   OR (a.estado IN ('aprobada','rechazada') AND NOT EXISTS(SELECT 1 FROM incidencias_seguimiento e WHERE e.incidencia_id=i.id AND e.accion=CASE WHEN a.estado='aprobada' THEN 'aprobar_ampliacion' ELSE 'rechazar_ampliacion' END))) ampliaciones_fuera_de_secuencia,
  (SELECT COUNT(*) FROM flujo_demo_turnos t WHERE NOT EXISTS(SELECT 1 FROM planes_operativos p WHERE p.servicio_id=t.servicio_id AND p.confirmado)) turnos_sin_plan,
  (SELECT COUNT(*) FROM servicios s LEFT JOIN sedes se ON se.id=s.sede_id LEFT JOIN personal p ON p.id=se.supervisor_id
   WHERE NOT s.eliminado AND s.codigo_externo LIKE 'DEMO-SRV-%' AND (se.cliente_id IS DISTINCT FROM s.cliente_id OR p.cargo IS DISTINCT FROM 'supervisor')) servicios_sin_sede_completa,
  (SELECT COUNT(*) FROM flujo_demo_turnos t WHERE t.ingreso_real IS NOT NULL AND (
   NOT EXISTS(SELECT 1 FROM turnos_historial h WHERE h.turno_id=t.id AND h.nuevo->>'estado'='sin_confirmar' AND h.nuevo->>'ingreso_real' IS NULL)
   OR NOT EXISTS(SELECT 1 FROM turnos_historial h WHERE h.turno_id=t.id AND h.nuevo->>'estado'='confirmado' AND h.nuevo->>'ingreso_real' IS NULL)
   OR NOT EXISTS(SELECT 1 FROM turnos_historial h WHERE h.turno_id=t.id AND h.nuevo->>'ingreso_real' IS NOT NULL AND h.nuevo->>'salida_real' IS NULL)
   OR (t.estado='cumplido' AND NOT EXISTS(SELECT 1 FROM turnos_historial h WHERE h.turno_id=t.id AND h.nuevo->>'salida_real' IS NOT NULL AND h.nuevo->>'estado'<>'cumplido')))) historial_sin_etapas`)).rows[0];
 return Object.fromEntries(Object.entries(r).map(([k,v])=>[k,Number(v)]));
}
async function regularizar(c){
 await c.query('SELECT pg_advisory_xact_lock(741110)');
 await preparar(c);
 const admin=(await c.query("SELECT id FROM usuarios WHERE rol='administrador' AND NOT eliminado AND activo ORDER BY id LIMIT 1")).rows[0]?.id;
 const jefe=(await c.query("SELECT id FROM usuarios WHERE rol='jefe_operaciones' AND NOT eliminado AND activo ORDER BY id LIMIT 1")).rows[0]?.id;
 if(!admin||!jefe)throw new Error('La demo requiere administrador y jefe de operaciones activos');
 await c.query("SELECT set_config('app.usuario_id',$1,true),set_config('app.motivo','DEMO: regularización de prerrequisitos y secuencia operativa',true)",[String(admin)]);
 const cambios={};
 const ejecutar=async(nombre,sql,params=[])=>{try{cambios[nombre]=(await c.query(sql,params)).rowCount;}catch(e){e.message=nombre+': '+e.message;throw e;}};
 // Las sedes geográficas antiguas de la demo se compartían entre varios clientes.
 // Separarlas por cliente conserva el cliente original de cada servicio.
 await ejecutar('sedes_base',`UPDATE sedes se SET cliente_id=x.cliente_id,supervisor_id=COALESCE(se.supervisor_id,x.supervisor_id)
  FROM (SELECT DISTINCT ON(sede_id) sede_id,cliente_id,supervisor_id FROM servicios WHERE NOT eliminado AND codigo_externo LIKE 'DEMO-SRV-%' ORDER BY sede_id,id)x
  WHERE se.id=x.sede_id AND se.cliente_id IS NULL AND NOT EXISTS(SELECT 1 FROM servicios real WHERE real.sede_id=se.id AND NOT real.eliminado AND COALESCE(real.codigo_externo,'') NOT LIKE 'DEMO-SRV-%')`);
 await ejecutar('sedes_por_cliente',`INSERT INTO sedes(nombre,direccion,cliente_id,supervisor_id)
  SELECT DISTINCT LEFT(se.nombre||' · '||c.nombre,120),se.direccion,s.cliente_id,s.supervisor_id FROM servicios s JOIN sedes se ON se.id=s.sede_id JOIN clientes c ON c.id=s.cliente_id
  WHERE NOT s.eliminado AND s.codigo_externo LIKE 'DEMO-SRV-%' AND se.cliente_id IS DISTINCT FROM s.cliente_id
  AND NOT EXISTS(SELECT 1 FROM sedes destino WHERE NOT destino.eliminado AND destino.cliente_id=s.cliente_id AND destino.nombre=LEFT(se.nombre||' · '||c.nombre,120))`);
 await ejecutar('servicios_sede',`UPDATE servicios s SET sede_id=destino.id FROM sedes se,clientes c,sedes destino
  WHERE s.sede_id=se.id AND c.id=s.cliente_id AND NOT s.eliminado AND s.codigo_externo LIKE 'DEMO-SRV-%' AND se.cliente_id IS DISTINCT FROM s.cliente_id
  AND NOT destino.eliminado AND destino.cliente_id=s.cliente_id AND destino.nombre=LEFT(se.nombre||' · '||c.nombre,120)`);
 await ejecutar('turnos_sede',`UPDATE turnos t SET sede_id=s.sede_id FROM servicios s WHERE t.servicio_id=s.id AND NOT t.eliminado AND s.codigo_externo LIKE 'DEMO-SRV-%' AND t.sede_id<>s.sede_id`);
 await ejecutar('agentes_sede',`UPDATE personal p SET sede_id=x.sede_id FROM (
  SELECT sp.personal_id,MIN(s.sede_id) sede_id FROM servicio_personal sp JOIN servicios s ON s.id=sp.servicio_id
  WHERE NOT sp.eliminado AND NOT s.eliminado GROUP BY sp.personal_id HAVING COUNT(DISTINCT s.sede_id)=1 AND BOOL_AND(COALESCE(s.codigo_externo,'') LIKE 'DEMO-SRV-%')
 )x WHERE p.id=x.personal_id AND p.cargo='agente' AND p.documento LIKE '8000%' AND (p.correo LIKE '%@segurtrack.example' OR p.correo LIKE '%@demo.segurtrack.example' OR p.correo='operador@segurtrack.com') AND p.sede_id<>x.sede_id`);
 // Las plazas vacantes y los turnos futuros permanecen en su etapa de programación.
 await ejecutar('futuros',`UPDATE turnos t SET estado='sin_confirmar',ingreso_real=NULL,salida_real=NULL,asistencia_validada=FALSE,
  evidencias='[]',evidencias_registradas=0,evidencia_registro=NULL FROM flujo_demo_turnos d
  WHERE t.id=d.id AND d.inicio_programado>NOW() AND (t.ingreso_real IS NOT NULL OR t.salida_real IS NOT NULL OR t.estado='cumplido')`);
 for(const tabla of ['obligaciones_operativas','rondas']){
  if(tabla==='obligaciones_operativas')await ejecutar('revisiones_sin_ejecucion',`DELETE FROM revisiones_reportes r USING obligaciones_operativas o,flujo_demo_turnos t
    WHERE r.reporte_id=o.id AND o.turno_id=t.id AND (t.personal_id IS NULL OR t.inicio_programado>NOW())`);
  await ejecutar(tabla+'_sin_prerrequisitos',`UPDATE ${tabla} o SET fecha_completada=NULL,completado_por=NULL,
    ${tabla==='rondas'?"estado='programada',observaciones=NULL":"resultado=NULL,primera_entrega_en=NULL,estado_revision='pendiente',revisado_por=NULL,fecha_revision=NULL"}
    FROM flujo_demo_turnos t WHERE o.turno_id=t.id AND NOT o.eliminado AND (t.personal_id IS NULL OR t.inicio_programado>NOW()) AND o.fecha_completada IS NOT NULL`);
 }
 await ejecutar('consignas_sin_prerrequisitos',`DELETE FROM verificaciones_consignas v USING flujo_demo_turnos t WHERE v.turno_id=t.id AND (t.personal_id IS NULL OR t.inicio_programado>NOW())`);
 // Restaurar relaciones que necesita el selector para los agentes de ejemplo.
 await ejecutar('vinculos_reactivados',`UPDATE servicio_personal sp SET eliminado=FALSE,eliminado_en=NULL,eliminado_por=NULL FROM flujo_demo_turnos t
  WHERE sp.servicio_id=t.servicio_id AND sp.personal_id=t.personal_id AND sp.eliminado
  AND sp.id=(SELECT MIN(x.id) FROM servicio_personal x WHERE x.servicio_id=sp.servicio_id AND x.personal_id=sp.personal_id)
  AND NOT EXISTS(SELECT 1 FROM servicio_personal activo WHERE activo.servicio_id=sp.servicio_id AND activo.personal_id=sp.personal_id AND NOT activo.eliminado)`);
 await ejecutar('vinculos_restaurados',`INSERT INTO servicio_personal(servicio_id,personal_id)
  SELECT DISTINCT t.servicio_id,t.personal_id FROM flujo_demo_turnos t JOIN personal p ON p.id=t.personal_id AND NOT p.eliminado
  WHERE NOT EXISTS(SELECT 1 FROM servicio_personal sp WHERE sp.servicio_id=t.servicio_id AND sp.personal_id=t.personal_id AND NOT sp.eliminado)`);
 // Si hay ejecución posterior, completar antes la asistencia sintética que la habilita.
 await ejecutar('ingresos',`UPDATE turnos t SET ingreso_real=d.inicio_programado,
  estado=CASE WHEN t.estado IN ('sin_confirmar','programado') THEN 'confirmado' ELSE t.estado END
  FROM flujo_demo_turnos d WHERE t.id=d.id AND d.personal_id IS NOT NULL AND d.inicio_programado<=NOW() AND t.ingreso_real IS NULL AND
  (t.estado='cumplido' OR t.salida_real IS NOT NULL OR EXISTS(SELECT 1 FROM obligaciones_operativas o WHERE o.turno_id=t.id AND NOT o.eliminado AND o.fecha_completada IS NOT NULL)
    OR EXISTS(SELECT 1 FROM rondas o WHERE o.turno_id=t.id AND NOT o.eliminado AND o.fecha_completada IS NOT NULL)
    OR EXISTS(SELECT 1 FROM verificaciones_consignas v WHERE v.turno_id=t.id))`);
 await ejecutar('ingresos_fuera_del_turno',`UPDATE turnos t SET ingreso_real=d.inicio_programado FROM flujo_demo_turnos d WHERE t.id=d.id AND t.ingreso_real>=d.fin_programado`);
 await ejecutar('salidas',`UPDATE turnos t SET salida_real=LEAST(NOW(),GREATEST(d.fin_programado,t.ingreso_real+INTERVAL '1 second')),
  asistencia_validada=TRUE FROM flujo_demo_turnos d WHERE t.id=d.id AND t.estado='cumplido' AND t.ingreso_real IS NOT NULL AND t.salida_real IS NULL`);
 await ejecutar('fotos_finales',`UPDATE turnos t SET evidencias=COALESCE(t.evidencias,'[]'::jsonb)||
  (SELECT COALESCE(jsonb_agg('/demo/evidencia-operativa.svg?turno='||t.id||'&registro='||n),'[]'::jsonb)
   FROM generate_series(jsonb_array_length(COALESCE(t.evidencias,'[]'::jsonb))+1,COALESCE(t.evidencias_requeridas,1)) n)
  WHERE t.id IN(SELECT id FROM flujo_demo_turnos) AND t.estado='cumplido' AND jsonb_array_length(COALESCE(t.evidencias,'[]'::jsonb))<COALESCE(t.evidencias_requeridas,1)`);
 await ejecutar('conteo_fotos',`UPDATE turnos t SET evidencias_registradas=jsonb_array_length(COALESCE(t.evidencias,'[]'::jsonb)),
  evidencia_registro=CASE WHEN jsonb_array_length(COALESCE(t.evidencias,'[]'::jsonb))>0 THEN LEAST(NOW(),GREATEST(t.ingreso_real,COALESCE(t.evidencia_registro,t.salida_real,t.ingreso_real))) END
  WHERE t.id IN(SELECT id FROM flujo_demo_turnos) AND (t.evidencias_registradas IS DISTINCT FROM jsonb_array_length(COALESCE(t.evidencias,'[]'::jsonb)) OR (t.estado='cumplido' AND t.evidencia_registro IS NULL AND jsonb_array_length(COALESCE(t.evidencias,'[]'::jsonb))>0))`);
 for(const tabla of ['obligaciones_operativas','rondas'])await ejecutar(tabla+'_fechas',`UPDATE ${tabla} o SET fecha_completada=LEAST(NOW(),COALESCE(t.salida_real,NOW()),GREATEST(t.inicio_programado,t.ingreso_real,o.fecha_completada))
  FROM flujo_demo_turnos t WHERE o.turno_id=t.id AND NOT o.eliminado AND o.fecha_completada IS NOT NULL AND t.ingreso_real IS NOT NULL
  AND (o.fecha_completada<GREATEST(t.ingreso_real,t.inicio_programado) OR o.fecha_completada>COALESCE(t.salida_real,NOW()) OR o.fecha_completada>NOW())`);
 await ejecutar('consignas_fechas',`UPDATE verificaciones_consignas v SET creado_en=LEAST(NOW(),COALESCE(t.salida_real,NOW()),GREATEST(t.inicio_programado,t.ingreso_real,v.creado_en))
  FROM flujo_demo_turnos t WHERE v.turno_id=t.id AND t.ingreso_real IS NOT NULL AND (v.creado_en<GREATEST(t.ingreso_real,t.inicio_programado) OR v.creado_en>COALESCE(t.salida_real,NOW()) OR v.creado_en>NOW())`);
 await ejecutar('reportes_entrega',`UPDATE obligaciones_operativas o SET primera_entrega_en=LEAST(COALESCE(o.primera_entrega_en,o.fecha_completada),o.fecha_completada),
  fecha_revision=CASE WHEN o.estado_revision<>'pendiente' THEN LEAST(NOW(),GREATEST(o.fecha_completada,COALESCE(o.fecha_revision,o.fecha_completada))) ELSE o.fecha_revision END
  WHERE o.turno_id IN(SELECT id FROM flujo_demo_turnos) AND o.tipo='reporte' AND o.fecha_completada IS NOT NULL
  AND (o.primera_entrega_en IS NULL OR o.primera_entrega_en>o.fecha_completada OR o.fecha_revision<o.fecha_completada OR o.fecha_revision>NOW())`);
 await ejecutar('historial_reportes',`UPDATE revisiones_reportes r SET fecha_entrega=o.fecha_completada,revisado_en=LEAST(NOW(),GREATEST(o.fecha_completada,r.revisado_en))
  FROM obligaciones_operativas o WHERE o.id=r.reporte_id AND o.turno_id IN(SELECT id FROM flujo_demo_turnos) AND r.version_entrega=o.version_entrega
  AND (r.fecha_entrega IS DISTINCT FROM o.fecha_completada OR r.revisado_en<o.fecha_completada OR r.revisado_en>NOW())`);
 // Elegir un turno histórico válido del servicio; nunca crear turnos que crucen los existentes.
 await c.query('DROP TABLE IF EXISTS pg_temp.flujo_demo_propuestas');
 await c.query(`CREATE TEMP TABLE flujo_demo_propuestas ON COMMIT DROP AS
  SELECT i.id,t.id turno_id,t.personal_id,p.usuario_id,
   LEAST(NOW()-INTERVAL '1 second',t.fin_programado-INTERVAL '1 second',GREATEST(t.inicio_programado,COALESCE(t.ingreso_real,t.inicio_programado))+INTERVAL '1 minute') registro
  FROM flujo_demo_incidencias i JOIN LATERAL(
   SELECT t.* FROM flujo_demo_turnos t JOIN personal p ON p.id=t.personal_id JOIN usuarios u ON u.id=p.usuario_id
   WHERE t.servicio_id=i.servicio_id AND t.inicio_programado<NOW()-INTERVAL '2 minutes' AND p.cargo='agente' AND NOT p.eliminado AND u.rol='operador' AND NOT u.eliminado
   ORDER BY (t.id=i.turno_id AND t.personal_id=i.responsable_id AND i.fecha_registro>=GREATEST(t.inicio_programado,COALESCE(t.ingreso_real,t.inicio_programado)) AND i.fecha_registro<t.fin_programado) DESC,
   (t.personal_id=i.responsable_id) DESC,ABS(EXTRACT(EPOCH FROM(t.inicio_programado-i.fecha_registro))) LIMIT 1
  )t ON TRUE JOIN personal p ON p.id=t.personal_id
  WHERE i.turno_id IS NULL OR NOT EXISTS(SELECT 1 FROM flujo_demo_turnos d WHERE d.id=i.turno_id AND d.personal_id=i.responsable_id AND d.servicio_id=i.servicio_id
   AND i.fecha_registro>=GREATEST(d.inicio_programado,COALESCE(d.ingreso_real,d.inicio_programado)) AND i.fecha_registro<d.fin_programado AND i.fecha_registro<=NOW())`);
 await ejecutar('incidencias_vinculos',`UPDATE incidencias i SET turno_id=p.turno_id,responsable_id=p.personal_id,personal_id=p.personal_id,registrado_por=p.usuario_id,
  fecha_atencion=CASE WHEN i.fecha_atencion IS NOT NULL THEN LEAST(NOW(),GREATEST(p.registro,i.fecha_atencion+(p.registro-i.fecha_registro))) END,
  fecha_cierre=CASE WHEN i.fecha_cierre IS NOT NULL THEN LEAST(NOW(),GREATEST(p.registro,i.fecha_cierre+(p.registro-i.fecha_registro))) END,
  fecha_registro=p.registro FROM flujo_demo_propuestas p WHERE p.id=i.id`);
 await ejecutar('incidencias_reporteros',`UPDATE incidencias i SET registrado_por=p.usuario_id FROM personal p
  WHERE i.id IN(SELECT id FROM flujo_demo_incidencias) AND p.id=i.responsable_id AND p.usuario_id IS NOT NULL AND i.registrado_por IS DISTINCT FROM p.usuario_id`);
 await ejecutar('ingresos_reporteros',`UPDATE turnos t SET ingreso_real=d.inicio_programado,estado=CASE WHEN t.estado IN ('sin_confirmar','programado') THEN 'confirmado' ELSE t.estado END
  FROM flujo_demo_turnos d WHERE t.id=d.id AND t.ingreso_real IS NULL AND EXISTS(SELECT 1 FROM flujo_demo_incidencias i WHERE i.turno_id=t.id)`);
 await ejecutar('resoluciones',`UPDATE incidencias i SET evidencias='["/evidencias-demo/correccion.svg"]'::jsonb,
  observacion=COALESCE(i.observacion,'DEMO: corrección completada y evidenciada.')
  WHERE i.id IN(SELECT id FROM flujo_demo_incidencias) AND i.estado='cerrada' AND jsonb_array_length(i.evidencias)=0`);
 await ejecutar('ampliaciones',`UPDATE incidencias_ampliaciones a SET solicitado_por=sup.usuario_id,
  solicitado_en=LEAST(NOW(),GREATEST(COALESCE(i.fecha_atencion,i.fecha_registro),a.solicitado_en)),
  decidido_por=CASE WHEN a.estado IN ('aprobada','rechazada') THEN $1 ELSE a.decidido_por END,
  decidido_en=CASE WHEN a.estado IN ('aprobada','rechazada') THEN LEAST(NOW(),GREATEST(COALESCE(i.fecha_atencion,i.fecha_registro),a.solicitado_en,COALESCE(a.decidido_en,a.solicitado_en))) ELSE a.decidido_en END
  FROM flujo_demo_incidencias i JOIN servicios s ON s.id=i.servicio_id JOIN personal sup ON sup.id=s.supervisor_id
  WHERE a.incidencia_id=i.id AND sup.usuario_id IS NOT NULL AND (a.solicitado_por<>sup.usuario_id OR (a.estado IN ('aprobada','rechazada') AND a.decidido_por<>$1)
   OR a.solicitado_en<COALESCE(i.fecha_atencion,i.fecha_registro) OR a.solicitado_en>NOW() OR a.decidido_en<a.solicitado_en OR a.decidido_en>NOW())`,[jefe]);
 // Reconstruir pasos faltantes y normalizar los actores/fechas de los pasos existentes.
 for(const [accion,campo,condicion] of [['registrar','fecha_registro','TRUE'],['atender','fecha_atencion',"i.estado<>'abierta'"],['resolver','fecha_cierre',"i.estado='cerrada'"]]){
  await ejecutar('eventos_'+accion,`INSERT INTO incidencias_seguimiento(incidencia_id,accion,comentario,evidencias,usuario_id,creado_en)
   SELECT i.id,$1,'DEMO: paso de '||$1||' regularizado según la secuencia operativa.',CASE WHEN $1='resolver' THEN i.evidencias ELSE '[]'::jsonb END,p.usuario_id,i.${campo}
   FROM flujo_demo_incidencias i JOIN personal p ON p.id=i.responsable_id WHERE ${condicion} AND i.${campo} IS NOT NULL AND p.usuario_id IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM incidencias_seguimiento e WHERE e.incidencia_id=i.id AND e.accion=$1)`,[accion]);
  await ejecutar('fechas_'+accion,`UPDATE incidencias_seguimiento e SET usuario_id=p.usuario_id,creado_en=i.${campo},evidencias=CASE WHEN e.accion='resolver' THEN i.evidencias ELSE e.evidencias END
   FROM flujo_demo_incidencias i JOIN personal p ON p.id=i.responsable_id WHERE e.incidencia_id=i.id AND e.accion=$1 AND ${condicion}
   AND (e.usuario_id IS DISTINCT FROM p.usuario_id OR e.creado_en IS DISTINCT FROM i.${campo} OR (e.accion='resolver' AND e.evidencias<>i.evidencias))`,[accion]);
 }
 for(const [accion,condicion,campo,actor] of [['solicitar_ampliacion','TRUE','solicitado_en','solicitado_por'],['aprobar_ampliacion',"a.estado='aprobada'",'decidido_en','decidido_por'],['rechazar_ampliacion',"a.estado='rechazada'",'decidido_en','decidido_por']]){
  await ejecutar('eventos_'+accion,`INSERT INTO incidencias_seguimiento(incidencia_id,accion,comentario,usuario_id,creado_en)
   SELECT a.incidencia_id,$1,'DEMO: '||$1||' por el rol correspondiente.',a.${actor},a.${campo}
   FROM incidencias_ampliaciones a JOIN flujo_demo_incidencias i ON i.id=a.incidencia_id WHERE ${condicion} AND a.${actor} IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM incidencias_seguimiento e WHERE e.incidencia_id=i.id AND e.accion=$1)`,[accion]);
  await ejecutar('roles_'+accion,`UPDATE incidencias_seguimiento e SET usuario_id=a.${actor},creado_en=a.${campo}
   FROM incidencias_ampliaciones a JOIN flujo_demo_incidencias i ON i.id=a.incidencia_id WHERE e.incidencia_id=i.id AND e.accion=$1 AND ${condicion}
   AND (e.usuario_id IS DISTINCT FROM a.${actor} OR e.creado_en IS DISTINCT FROM a.${campo})`,[accion]);
 }
 // El registro inicial tampoco debe saltar directamente a «cumplido».
 await ejecutar('historial_inicial',`UPDATE turnos_historial h SET nuevo=h.nuevo||jsonb_build_object('estado','sin_confirmar','ingreso_real',NULL,'salida_real',NULL,
  'asistencia_validada',FALSE,'evidencias','[]'::jsonb,'evidencias_registradas',0,'evidencia_registro',NULL),
  creado_en=LEAST(h.creado_en,COALESCE(t.ingreso_real,t.inicio_programado)-INTERVAL '2 minutes')
  FROM flujo_demo_turnos t WHERE h.turno_id=t.id AND h.anterior IS NULL
  AND (h.nuevo->>'estado'<>'sin_confirmar' OR h.nuevo->>'ingreso_real' IS NOT NULL OR h.nuevo->>'salida_real' IS NOT NULL)`);
 await ejecutar('historial_pasos',`WITH fases AS(
  SELECT t.id,t.creado_por,t.ingreso_real,t.salida_real,t.evidencia_registro,t.estado,to_jsonb(t)-'inicio_programado'-'fin_programado' datos,
   (to_jsonb(t)-'inicio_programado'-'fin_programado')||jsonb_build_object('estado','confirmado','ingreso_real',NULL,'salida_real',NULL,
    'asistencia_validada',FALSE,'evidencias','[]'::jsonb,'evidencias_registradas',0,'evidencia_registro',NULL) confirmado
  FROM flujo_demo_turnos t WHERE t.ingreso_real IS NOT NULL
 ),pasos AS(
  SELECT f.id,f.creado_por,p.paso,p.fecha,p.anterior,p.nuevo FROM fases f CROSS JOIN LATERAL(VALUES
   ('confirmar',f.ingreso_real-INTERVAL '1 second',f.confirmado||'{"estado":"sin_confirmar"}'::jsonb,f.confirmado),
   ('ingreso',f.ingreso_real,f.confirmado,f.confirmado||jsonb_build_object('ingreso_real',f.ingreso_real)),
   ('evidencias',GREATEST(f.ingreso_real,LEAST(COALESCE(f.salida_real,NOW()),COALESCE(f.evidencia_registro,f.ingreso_real))),f.confirmado||jsonb_build_object('ingreso_real',f.ingreso_real),f.datos||jsonb_build_object('estado','confirmado','salida_real',NULL)),
   ('salida',f.salida_real,f.datos||jsonb_build_object('estado','confirmado','salida_real',NULL),f.datos||'{"estado":"confirmado"}'::jsonb),
   ('finalizar',CASE WHEN f.estado='cumplido' THEN GREATEST(f.salida_real,COALESCE(f.evidencia_registro,f.salida_real)) END,f.datos||'{"estado":"confirmado"}'::jsonb,f.datos)
  )p(paso,fecha,anterior,nuevo) WHERE p.fecha IS NOT NULL
 )INSERT INTO turnos_historial(turno_id,usuario_id,motivo,creado_en,anterior,nuevo)
 SELECT p.id,COALESCE(p.creado_por,$1),'DEMO · Paso regularizado: '||p.paso,p.fecha,p.anterior,p.nuevo FROM pasos p
 WHERE NOT EXISTS(SELECT 1 FROM turnos_historial h WHERE h.turno_id=p.id AND h.motivo='DEMO · Paso regularizado: '||p.paso)`,[admin]);
 const despues=await auditar(c);
 if(Object.values(despues).some(n=>n!==0))throw new Error('Persisten inconsistencias en la demo: '+JSON.stringify(despues));
 return {cambios,despues};
}
module.exports={preparar,auditar,regularizar};

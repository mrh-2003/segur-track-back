'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {calcular,evaluarFuentes,filtros,franja}=require('../src/services/evaluacion-operativa');
const defs=Array.from({length:5},(_,i)=>({codigo:'C0'+(i+1),nombre:'Criterio '+i,peso:.2,umbral:20}));
const corte='2026-11-18T22:00:00Z';
const turno=(x={})=>({id:1,servicio_id:1,personal_id:1,dia:'2026-11-18',inicio_programado:'2026-11-18T11:00:00Z',fin_programado:'2026-11-18T19:00:00Z',ingreso_real:'2026-11-18T11:10:00Z',asistencia_validada:true,tolerancia_min:10,plan_kpi_validado:true,...x});
const fuentes=(x={})=>({evidenciasServicio:[],verificacionesConsignas:[],rondas:[],obligaciones:[],...x});
const obligacion=(x={})=>({turno_id:1,tipo:'actividad',fecha_limite:'2026-11-18T19:00:00Z',fecha_completada:'2026-11-18T19:00:00Z',...x});
const incidencia=(x={})=>({servicio_id:1,fecha_registro:'2026-11-18T11:00:00Z',sla_min:60,sla_resolucion_min:120,fecha_atencion:'2026-11-18T12:00:00Z',fecha_cierre:'2026-11-18T13:00:00Z',estado:'cerrada',...x});

test('las incidencias críticas se aceptan y preceden a las altas sin cambiar su SLA explícito',()=>{
 const {esquemaCrear}=require('../src/validators/incidencias.validator');
 const entrada=esquemaCrear.parse({tipoIncidenciaId:1,servicioId:1,descripcion:'Incidencia crítica de prueba',prioridad:'critica',slaMin:15,slaResolucionMin:60});
 assert.equal(entrada.slaMin,15);assert.equal(entrada.slaResolucionMin,60);
 const inc=['baja','alta','critica','media'].map((prioridad,id)=>incidencia({id,prioridad,estado:'abierta',fecha_atencion:null,fecha_cierre:null}));
 const r=evaluarFuentes({servicios:[{id:1,nombre:'Servicio'}],turnos:[turno()],incidencias:inc,criterios:defs,corte,...fuentes()},{periodo:'todos'});
 assert.deepEqual(r.criticas.map(i=>i.prioridad),['critica','alta','media','baja']);
});
test('los diez KPI tienen cantidades independientes y criticidad reproducible',()=>{
 const r=calcular([turno(),turno({id:2,ingreso_real:null})],[incidencia(),incidencia({estado:'abierta',fecha_atencion:null,fecha_cierre:null})],defs,corte,fuentes({
 evidenciasServicio:[{turno_id:1,protocolo_id:1,estado_revision:'aprobada',fecha_revision:corte},{turno_id:1,protocolo_id:1,estado_revision:'observada',fecha_revision:corte}],
 verificacionesConsignas:[{turno_id:1,cumplida:true,creado_en:corte},{turno_id:1,cumplida:false,creado_en:corte}],
 obligaciones:[obligacion(),obligacion({fecha_completada:null}),obligacion({tipo:'reporte'}),obligacion({tipo:'reporte',fecha_completada:'2026-11-18T20:00:00Z'})],
 rondas:[{turno_id:1,estado:'completada',fecha_programada:'2026-11-18T18:00:00Z',fecha_completada:'2026-11-18T19:00:00Z'},{turno_id:1,estado:'omitida',fecha_programada:'2026-11-18T18:00:00Z'}]}));
 assert.deepEqual(r.criterios.flatMap(c=>[c.kpi01.tasa,c.kpi02.tasa]),[50,100,50,50,50,50,100,50,50,50]);
 assert.equal(r.criticidad,100);assert.equal(r.puntaje,r.criticidad);assert.equal(r.nivel,'alta');assert.equal(r.criticidad,r.criterios.reduce((n,c)=>n+c.aporte,0));
});
test('sin casos confirmado difiere de fuentes o planificación desconocidas',()=>{
 const r=calcular([turno()],[],defs,corte,fuentes());assert.equal(r.completo,true);assert.equal(r.criticidad,0);assert.equal(r.criterios[2].estado,'Sin casos');
 for(const f of [undefined,fuentes({obligaciones:null}),fuentes({rondas:null}),fuentes({verificacionesConsignas:null})]) assert.equal(calcular([turno()],[],defs,corte,f).criticidad,null);
 const pendiente=calcular([turno({plan_kpi_validado:false})],[],defs,corte,fuentes());assert.equal(pendiente.criterios[2].estado,'Faltan datos');assert.equal(pendiente.criterios[3].estado,'Faltan datos');assert.equal(calcular([],[],defs,corte,fuentes()).criticidad,null);
});
test('vacantes reducen asistencia sin inventar tardanzas',()=>{
 const r=calcular([turno(),turno({id:2,personal_id:null,ingreso_real:null,asistencia_validada:false})],[],defs,corte,fuentes());assert.equal(r.criterios[0].kpi01.tasa,50);assert.equal(r.criterios[0].kpi02.tasa,100);assert.equal(r.sin_cubrir,1);assert.equal(calcular([turno({asistencia_validada:false})],[],defs,corte,fuentes()).criticidad,null);
});
test('protocolos excluyen fotos generales, pendientes, eliminados y revisiones futuras',()=>{
 const r=calcular([turno()],[],defs,corte,fuentes({evidenciasServicio:[
 {turno_id:1,protocolo_id:1,estado_revision:'aprobada',conforme:false,fecha_revision:corte},
 {turno_id:1,estado_revision:'aprobada',fecha_revision:corte},
 {turno_id:1,protocolo_id:1,estado_revision:'pendiente',fecha_revision:corte},
 {turno_id:1,protocolo_id:1,estado_revision:'aprobada',eliminado:true,fecha_revision:corte},
 {turno_id:1,protocolo_id:1,estado_revision:'aprobada',fecha_revision:'2026-11-19T00:00:00Z'}]}));assert.equal(r.criterios[1].kpi01.denominador,1);assert.equal(r.criterios[1].kpi01.tasa,0);
});
test('cada obligación cuenta por separado, futuros y anulados no son exigibles',()=>{
 const r=calcular([turno()],[],defs,corte,fuentes({obligaciones:[obligacion(),obligacion({fecha_completada:null}),obligacion({eliminado:true}),obligacion({fecha_limite:'2026-11-19T19:00:00Z'}),obligacion({tipo:'reporte',fecha_completada:null}),obligacion({tipo:'reporte',fecha_completada:'2026-11-18T20:00:00Z'})]}));assert.equal(r.criterios[2].kpi01.tasa,50);assert.equal(r.criterios[3].kpi01.tasa,50);assert.equal(r.criterios[3].kpi02.tasa,0);
});
test('la atención temprana no vuelve exigible la resolución no vencida',()=>{
 const r=calcular([turno()],[incidencia({fecha_registro:'2026-11-18T21:00:00Z',fecha_atencion:'2026-11-18T21:30:00Z',fecha_cierre:null,estado:'en_atencion',sla_resolucion_min:1440})],defs,corte,fuentes());assert.equal(r.criterios[4].kpi01.denominador,0);assert.equal(r.criterios[4].kpi02.tasa,100);assert.equal(calcular([turno()],[incidencia({sla_resolucion_min:null})],defs,corte,fuentes()).criticidad,null);
});
test('fechas posteriores al corte no mejoran resultados; límites inclusivos',()=>{
 const r=calcular([turno()],[incidencia()],defs,corte,fuentes({obligaciones:[obligacion({tipo:'reporte'}),obligacion({tipo:'reporte',fecha_completada:'2026-11-19T00:00:00Z'})]}));assert.equal(r.criterios[0].kpi02.tasa,100);assert.equal(r.criterios[4].tasa,100);assert.equal(r.criterios[3].kpi02.tasa,50);
});
test('periodo, franja, servicio y evolución filtran las fuentes',()=>{
 const r=evaluarFuentes({servicios:[{id:1,nombre:'Uno'},{id:2,nombre:'Dos'}],turnos:[turno(),turno({id:2,servicio_id:2}),turno({id:3,inicio_programado:'2026-11-19T11:00:00Z'})],incidencias:[],criterios:defs,corte,...fuentes()},{periodo:'3',servicios:'1',turno:'diurno'});assert.equal(r.tabla.length,1);assert.equal(r.tabla[0].turnos,1);assert.equal(r.evolucion.length,1);assert.equal(r.version,'operativo-v4');assert.equal(filtros({periodo:'3'},new Date(corte)).inicio,'2026-11-16T05:00:00.000Z');assert.equal(franja('2026-11-19T04:00:00Z'),'nocturno');assert.throws(()=>filtros({servicios:'1);DROP'}));assert.throws(()=>filtros({periodo:'365'}));
});

test('la ampliación solo cambia la exigibilidad cuando existe un plazo aprobado',()=>{
 const pendiente=incidencia({estado:'en_atencion',fecha_cierre:null,ampliacion_pendiente:true});
 assert.equal(calcular([turno()],[pendiente],defs,corte,fuentes()).criterios[4].kpi01.denominador,1);
 const aprobada={...pendiente,plazo_resolucion_extendido:'2026-11-19T22:00:00Z'};
 assert.equal(calcular([turno()],[aprobada],defs,corte,fuentes()).criterios[4].kpi01.denominador,0);
 const cerrada={...aprobada,estado:'cerrada',fecha_cierre:'2026-11-18T21:00:00Z'};
 assert.equal(calcular([turno()],[cerrada],defs,corte,fuentes()).criterios[4].kpi01.tasa,100);
});

test('el análisis por agente conserva la franja del turno de referencia de una incidencia',()=>{
 const propio=turno({id:1,inicio_programado:'2026-11-18T05:00:00Z'}),otro=turno({id:2,personal_id:2,inicio_programado:'2026-11-18T23:00:00Z'});
 const r=evaluarFuentes({servicios:[{id:1,nombre:'Servicio'}],turnos:[propio],turnosReferencia:[propio,otro],
  incidencias:[incidencia({turno_id:2,fecha_registro:'2026-11-18T15:00:00Z'})],criterios:defs,corte,...fuentes()}, {periodo:'todos',turno:'nocturno'});
 assert.equal(r.tabla[0].criterios[4].kpi01.denominador,1);
});

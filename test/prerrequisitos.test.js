'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {motivoBloqueo}=require('../src/services/datos-kpi.service');
test('la ejecución exige asignación, confirmación, inicio e ingreso en ese orden',()=>{
 const calendario={inicio_programado:'2026-11-23T12:00:00Z',corte:'2026-11-23T15:00:00Z'};
 const t={personal_id:null,estado:'sin_confirmar',ingreso_real:null};
 assert.match(motivoBloqueo(t,calendario),/asigne un agente/);
 t.personal_id=1;assert.match(motivoBloqueo(t,calendario),/confirme/);
 t.estado='confirmado';assert.match(motivoBloqueo(t,{...calendario,corte:'2026-11-23T11:00:00Z'}),/todavía no comienza/);
 assert.match(motivoBloqueo(t,calendario),/registre el ingreso/);
 t.ingreso_real='2026-11-23T16:00:00Z';assert.match(motivoBloqueo(t,calendario),/futuro/);
 t.ingreso_real='2026-11-23T12:00:00Z';assert.equal(motivoBloqueo(t,calendario),null);
 t.relevo_pendiente=true;assert.match(motivoBloqueo(t,calendario),/asigne un agente/);
});

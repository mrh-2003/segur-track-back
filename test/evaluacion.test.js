'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  calcular,
  evaluarFuentes,
  filtros,
  franja,
} = require('../src/services/evaluacion-operativa');
const defs = [
  'Cumplimiento',
  'Puntualidad',
  'Cobertura',
  'Evidencias',
  'Atención',
].map((nombre, i) => ({
  codigo: 'C' + (i + 1),
  nombre,
  peso: 0.2,
  umbral: [10, 20, 10, 10, 30][i],
}));
const corte = '2026-11-03T22:00:00Z';
const turno = (c = {}) => ({
  id: 1,
  servicio_id: 1,
  dia: '2026-11-03',
  personal_id: 1,
  inicio_programado: '2026-11-03T11:00:00Z',
  fin_programado: '2026-11-03T19:00:00Z',
  ingreso_real: '2026-11-03T11:05:00Z',
  salida_real: '2026-11-03T19:00:00Z',
  asistencia_validada: true,
  estado: 'cumplido',
  tolerancia_min: 10,
  evidencias_requeridas: 2,
  evidencias_registradas: 2,
  evidencia_limite: '2026-11-03T19:00:00Z',
  evidencia_registro: '2026-11-03T18:59:00Z',
  ...c,
});
test('los cinco criterios usan hechos y producen aportes reproducibles', () => {
  const r = calcular(
    [
      turno(),
      turno({
        id: 2,
        ingreso_real: '2026-11-03T11:30:00Z',
        salida_real: '2026-11-03T18:00:00Z',
        estado: 'pendiente',
        evidencias_registradas: 1,
        evidencia_registro: '2026-11-03T20:00:00Z',
      }),
    ],
    [
      {
        fecha_registro: '2026-11-03T11:00:00Z',
        fecha_atencion: '2026-11-03T11:30:00Z',
        sla_min: 60,
        estado: 'cerrada',
      },
      {
        fecha_registro: '2026-11-03T12:00:00Z',
        sla_min: 60,
        estado: 'abierta',
      },
    ],
    defs,
    corte
  );
  assert.deepEqual(
    r.criterios.map((c) => c.tasa),
    [50, 50, 100, 50, 50]
  );
  assert.equal(r.puntaje, 80);
  assert.equal(r.nivel, 'alta');
  assert.equal(
    r.criterios.reduce((n, c) => n + c.aporte, 0),
    r.puntaje
  );
});
test('los datos desconocidos no se convierten en resultados saludables', () => {
  assert.equal(
    calcular([turno({ asistencia_validada: false })], [], defs, corte).puntaje,
    null
  );
  assert.equal(calcular([], [], defs, corte).puntaje, null);
  assert.equal(
    calcular([turno({ evidencias_requeridas: null })], [], defs, corte).puntaje,
    null
  );
  assert.equal(
    calcular([turno()], [{ sla_min: null }], defs, corte).puntaje,
    null
  );
});
test('una vacante afecta cobertura y cumplimiento, no inventa una tardanza', () => {
  const r = calcular(
    [
      turno(),
      turno({
        personal_id: null,
        ingreso_real: null,
        salida_real: null,
        estado: 'sin_confirmar',
        asistencia_validada: false,
      }),
    ],
    [],
    defs,
    corte
  );
  assert.equal(r.criterios[2].tasa, 50);
  assert.equal(r.criterios[0].tasa, 50);
  assert.equal(r.criterios[1].tasa, 100);
  assert.equal(r.sin_cubrir, 1);
});
test('SLA y tolerancia incluyen el instante exacto del límite', () => {
  const r = calcular(
    [turno({ ingreso_real: '2026-11-03T11:10:00Z' })],
    [
      {
        fecha_registro: '2026-11-03T11:00:00Z',
        fecha_atencion: '2026-11-03T12:00:00Z',
        sla_min: 60,
      },
    ],
    defs,
    corte
  );
  assert.equal(r.criterios[1].tasa, 100);
  assert.equal(r.criterios[4].tasa, 100);
});
test('las evidencias vinculadas al turno participan sin duplicar declaraciones', () => {
  const r = calcular(
    [turno({ evidencias_registradas: 1, evidencias_vinculadas_en_plazo: 1 })],
    [],
    defs,
    corte
  );
  assert.equal(r.criterios[3].numerador, 1);
  const tardia = calcular(
    [
      turno({
        evidencia_registro: '2026-11-03T20:00:00Z',
        evidencias_vinculadas_en_plazo: 1,
      }),
    ],
    [],
    defs,
    corte
  );
  assert.equal(tardia.criterios[3].tasa, 50);
});
test('periodo, franja y servicios filtran los hechos sin incluir el futuro', () => {
  const datos = {
    servicios: [
      { id: 1, nombre: 'Custodia', cliente: 'Cliente' },
      { id: 2, nombre: 'Otra' },
    ],
    turnos: [
      turno(),
      turno({ id: 2, servicio_id: 2 }),
      turno({
        id: 3,
        inicio_programado: '2026-11-04T11:00:00Z',
        fin_programado: '2026-11-04T19:00:00Z',
      }),
    ],
    incidencias: [],
    criterios: defs,
    corte,
  };
  const r = evaluarFuentes(datos, {
    periodo: '3',
    servicios: '1',
    turno: 'diurno',
  });
  assert.equal(r.tabla.length, 1);
  assert.equal(r.tabla[0].turnos, 1);
  assert.equal(r.evolucion.length, 1);
  assert.equal(franja('2026-11-04T04:00:00Z'), 'nocturno');
  assert.equal(
    filtros({ periodo: '3' }, new Date(corte)).inicio,
    '2026-11-01T05:00:00.000Z'
  );
  assert.throws(() => filtros({ servicios: '1);DROP' }));
  assert.throws(() => filtros({ periodo: '365' }));
});

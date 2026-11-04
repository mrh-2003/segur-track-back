'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cubreHorario } = require('../src/utils/horario-personal');
test('jornada nocturna respeta el día de inicio y admite terminar al día siguiente', () => {
  const p = { horario_inicio:'22:00:00',horario_fin:'06:00:00',dias_laborales:[1] };
  assert.equal(cubreHorario(p,'2026-11-02T23:00:00-05:00','2026-11-03T05:00:00-05:00'),true);
  assert.equal(cubreHorario(p,'2026-11-03T01:00:00-05:00','2026-11-03T06:00:00-05:00'),true);
  assert.equal(cubreHorario(p,'2026-11-03T22:00:00-05:00','2026-11-04T06:00:00-05:00'),false);
  assert.equal(cubreHorario(p,'2026-11-02T21:00:00-05:00','2026-11-03T06:00:00-05:00'),false);
});
test('horario flexible conserva días laborales y la jornada diurna exige cobertura completa', () => {
  assert.equal(cubreHorario({dias_laborales:[1]},'2026-11-02T09:00:00-05:00','2026-11-02T18:00:00-05:00'),true);
  assert.equal(cubreHorario({dias_laborales:[1]},'2026-11-03T09:00:00-05:00','2026-11-03T18:00:00-05:00'),false);
  const p = {horario_inicio:'08:00:00',horario_fin:'18:00:00'};
  assert.equal(cubreHorario(p,'2026-11-02T08:00:00-05:00','2026-11-02T18:00:00-05:00'),true);
  assert.equal(cubreHorario(p,'2026-11-02T08:00:00-05:00','2026-11-02T19:00:00-05:00'),false);
});

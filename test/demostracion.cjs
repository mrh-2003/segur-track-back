'use strict';
const assert = require('node:assert/strict');
const repo = require('../src/repositories/operacion.repository');
const { evaluarFuentes } = require('../src/services/evaluacion-operativa');
const pool = require('../src/config/db');
(async () => {
  const datos = await repo.fuentes();
  assert.ok(datos.demo, 'No está activo el conjunto de demostración');
  const pruebas = [];
  for (const periodo of ['3', '7', '30', 'todos'])
    for (const turno of ['ambos', 'diurno', 'nocturno']) {
      const r = evaluarFuentes(datos, { periodo, turno });
      assert.equal(r.tabla.length, 12);
      assert.ok(
        r.tabla.every(
          (s) =>
            s.completo &&
            Number.isFinite(s.puntaje) &&
            s.criterios.every(
              (c) => c.faltantes === 0 && Number.isFinite(c.tasa)
            )
        ),
        `Faltan datos en ${periodo}/${turno}`
      );
      pruebas.push(`${periodo}/${turno}: ${r.resumen.evaluados}/12`);
    }
  const r = evaluarFuentes(datos, { periodo: '30' });
  assert.equal(new Set(r.tabla.map((s) => s.nivel)).size, 3);
  console.log(
    JSON.stringify({
      verificaciones: pruebas,
      servicios: datos.servicios.length,
      turnos: datos.turnos.length,
      incidencias: datos.incidencias.length,
      niveles: ['alta', 'media', 'baja'],
      sinDatosInsuficientes: true,
    })
  );
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

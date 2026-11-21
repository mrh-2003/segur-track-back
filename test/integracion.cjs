'use strict';
// Ejecuta escrituras contra la base configurada, siempre dentro de un rollback exterior.
const assert = require('node:assert/strict');
const pool = require('../src/config/db');
const svc = require('../src/services/operacion.service');
const importar = require('../src/services/importaciones.service');
const ExcelJS = require('exceljs');
(async () => {
  const c = await pool.connect(),
    connectOriginal = pool.connect.bind(pool),
    queryOriginal = pool.query.bind(pool);
  let nivel = 0;
  await c.query('BEGIN');
  pool.query = (...args) => c.query(...args);
  pool.connect = async () => ({
    release() {},
    query: async (sql, params) => {
      if (/^BEGIN/.test(sql)) {
        nivel++;
        return c.query('SAVEPOINT prueba_' + nivel);
      }
      if (sql === 'COMMIT') {
        const r = await c.query('RELEASE SAVEPOINT prueba_' + nivel);
        nivel--;
        return r;
      }
      if (sql === 'ROLLBACK') {
        await c.query('ROLLBACK TO SAVEPOINT prueba_' + nivel);
        const r = await c.query('RELEASE SAVEPOINT prueba_' + nivel);
        nivel--;
        return r;
      }
      return c.query(sql, params);
    },
  });
  try {
    const u = (
      await c.query(
        "SELECT id,rol FROM usuarios WHERE rol='administrador' AND NOT eliminado LIMIT 1"
      )
    ).rows[0];
    assert.ok(u);
    const s = (
      await c.query('SELECT * FROM servicios WHERE NOT eliminado LIMIT 1')
    ).rows[0];
    const sup = (
      await c.query(
        "SELECT * FROM personal WHERE cargo IN ('supervisor','jefe_operaciones') AND estado='activo' AND NOT eliminado LIMIT 1"
      )
    ).rows[0];
    let dni = '90000000';
    while (
      (await c.query('SELECT 1 FROM personal WHERE documento=$1', [dni]))
        .rowCount
    )
      dni = String(Number(dni) + 1);
    const p = (
      await c.query(
        "INSERT INTO personal(nombres,apellidos,documento,cargo,sede_id) VALUES('PRUEBA','ROLLBACK',$1,'agente',$2) RETURNING id",
        [dni, s.sede_id]
      )
    ).rows[0];
    await c.query('INSERT INTO servicio_personal(servicio_id,personal_id) VALUES($1,$2)', [s.id,p.id]);
    const d = {
      personalId: p.id,
      servicioId: s.id,
      sedeId: s.sede_id,
      fecha: '2024-01-01',
      horaInicio: '22:00',
      horaFin: '06:00',
      puesto: 'Puesto de prueba',
      evidenciasRequeridas: 1,
    };
    const t = await svc.crearTurno(d, u);
    assert.ok(t.id);
    await assert.rejects(
      () =>
        svc.crearTurno(
          { ...d, fecha: '2024-01-02', horaInicio: '01:00', horaFin: '07:00' },
          u
        ),
      /otro turno/
    );
    const vacante = await svc.crearTurno(
      { ...d, personalId: null, fecha: '2024-01-03' },
      u
    );
    await svc.reasignar(
      vacante.id,
      { personalId: p.id, motivo: 'Asignación de prueba' },
      u
    );
    const hist = await svc.historial(vacante.id, u);
    assert.equal(hist[0].usuario_id, u.id);
    assert.equal(hist[0].anterior.personal_id, null);
    assert.equal(hist[0].nuevo.personal_id, p.id);
    assert.equal(hist[0].nuevo.creado_por, u.id);
    // La consulta de disponibilidad y la creación aplican las mismas reglas.
    await c.query("UPDATE servicios SET estado='en_curso',fecha_inicio='2024-01-01',fecha_fin='2029-12-31' WHERE id=$1", [s.id]);
    let opciones = await svc.opcionesTurno({fecha:'2024-01-04',horaInicio:'22:00',horaFin:'06:00'},u);
    assert.ok(opciones.compatibilidades.some((x) => x.personalId===p.id && x.servicioId===s.id));
    opciones = await svc.opcionesTurno({fecha:'2024-01-02',horaInicio:'01:00',horaFin:'05:00'},u);
    assert.ok(!opciones.compatibilidades.some((x) => x.personalId===p.id));
    await c.query("UPDATE personal SET horario_inicio='08:00',horario_fin='18:00' WHERE id=$1",[p.id]);
    await assert.rejects(() => svc.crearTurno({...d,fecha:'2024-01-04'},u), /horario laboral/);
    await c.query('UPDATE personal SET horario_inicio=NULL,horario_fin=NULL WHERE id=$1',[p.id]);
    const abierto = await svc.crearTurno({...d,fecha:'2024-01-04'},u);
    await c.query("UPDATE turnos SET estado='confirmado',ingreso_real=NOW()-INTERVAL '1 hour',asistencia_validada=TRUE,evidencias=$2 WHERE id=$1",[abierto.id,JSON.stringify(['/demo/evidencia-operativa.svg?turno=prueba'])]);
    const salida = await svc.asistencia(abierto.id,{accion:'salida'},u);
    assert.ok(salida.salida_real);
    assert.equal(salida.asistencia_validada,false);
    await assert.rejects(() => svc.asistencia(abierto.id,{accion:'salida'},u),/registró la salida/);
    await assert.rejects(() => svc.cambiarTurno(abierto.id,'cumplir',{evidencias:['javascript:alert(1)']},u),/HTTPS/);
    await c.query('UPDATE configuracion_operativa SET datos_demo=TRUE WHERE id=1');
    await assert.rejects(() => svc.cambiarTurno(abierto.id,'cumplir',{evidencias:['/demo/evidencia-operativa.svg?turno=no-registrado']},u),/HTTPS/);
    const cerrado = await svc.cambiarTurno(abierto.id,'cumplir',{evidencias:['/demo/evidencia-operativa.svg?turno=prueba','https://example.com/evidencia.jpg']},u);
    assert.equal(cerrado.estado,'cumplido');
    const monitor = require('../src/repositories/monitor.repository');
    const ind = await monitor.obtenerIndicadoresOperativos({});
    const esperado = (await c.query('SELECT COUNT(*) n FROM turnos t JOIN servicios s ON s.id=t.servicio_id WHERE NOT t.eliminado AND NOT s.eliminado AND t.fecha BETWEEN CURRENT_DATE-30 AND CURRENT_DATE')).rows[0];
    assert.equal(Number(ind.total_turnos),Number(esperado.n));
    assert.equal((await monitor.obtenerHistorialIndicadores({periodos:6})).length,6);
    assert.ok((await monitor.obtenerIndicadoresPorServicio({periodos:6})).length);
    await svc.asistencia(
      t.id,
      {
        ingresoReal: '2024-01-02T03:00:00Z',
        salidaReal: '2024-01-02T11:00:00Z',
        validada: true,
        toleranciaMin: 10,
        evidenciasRequeridas: 1,
        evidenciasRegistradas: 1,
        evidenciaLimite: '2024-01-02T11:00:00Z',
        evidenciaRegistro: '2024-01-02T10:00:00Z',
        puesto: 'Agencia',
        motivo: 'Validación de prueba',
      },
      u
    );
    await assert.rejects(
      () =>
        svc.reasignar(
          t.id,
          { personalId: sup.id, motivo: 'Prueba de bloqueo' },
          u
        ),
      /ejecutado/
    );
    const encargado=(await c.query(`SELECT p.id,sp.servicio_id FROM personal p JOIN usuarios u ON u.id=p.usuario_id JOIN servicio_personal sp ON sp.personal_id=p.id WHERE u.rol='operador' AND u.activo AND NOT u.eliminado AND NOT p.eliminado AND p.estado='activo' AND NOT sp.eliminado LIMIT 1`)).rows[0];
    const i=await require('../src/services/incidencias-operativas.service').guardar(null,{tipoIncidenciaId:1,servicioId:encargado.servicio_id,descripcion:'Incidencia de prueba transaccional',prioridad:'alta',responsableId:encargado.id},u);
    assert.equal(i.sla_min,60);assert.equal(i.responsable_id,encargado.id);
    const flujo=require('../src/services/incidencias-flujo.service');
    await flujo.actuar(i.id,{accion:'atender'},u);
    const cerrada=await flujo.actuar(i.id,{accion:'resolver',comentario:'Corrección de prueba completada con evidencia',evidencias:['https://example.test/correccion.png']},u);
    assert.ok(cerrada.fecha_atencion);assert.ok(cerrada.fecha_cierre);
    const w = new ExcelJS.Workbook();
    await w.xlsx.load(await importar.plantilla());
    const sheet = w.getWorksheet('Tareaje');
    const headers = sheet.getRow(1).values.slice(1),
      r = {
        Empresa: 'CLIENTE PRUEBA ROLLBACK',
        'Codigo servicio': 'TEST-CUSTODIA',
        'Codigo turno': 'TEST-TURNO-1',
        DNI: dni,
        Sede: 'SEDE PRUEBA ROLLBACK',
        'Supervisor DNI': sup.documento,
        Puesto: 'Almacén prueba',
        'Inicio programado': '2024-02-01 06:00',
        'Fin programado': '2024-02-01 14:00',
        'Ingreso real': '2024-02-01 05:59',
        'Salida real': '2024-02-01 14:00',
        'Asistencia validada': 'SI',
        'Estado turno': 'cumplido',
        'Evidencias requeridas': 1,
        'Evidencias registradas': 1,
        'Limite evidencias': '2024-02-01 14:00',
        'Fecha registro evidencias': '2024-02-01 13:00',
        'Cliente/Almacen': 'ALMACEN PRUEBA',
        'PUNTO INICIO': 'ORIGEN PRUEBA',
        'PUNTO FINAL': 'DESTINO PRUEBA',
      };
    sheet.addRow(headers.map((h) => r[h] ?? null));
    sheet.addRow(
      headers.map(
        (h) =>
          ({
            ...r,
            'Codigo turno': 'TEST-TURNO-2',
            DNI: '',
            'Estado turno': 'sin_asignar',
            'Ingreso real': '',
            'Salida real': '',
            'Asistencia validada': 'NO',
          })[h] ?? null
      )
    );
    const base64 = Buffer.from(await w.xlsx.writeBuffer()).toString('base64');
    const lote = await importar.preparar({ nombre: 'prueba.xlsx', base64 }, u);
    assert.deepEqual(lote.errores, []);
    const result = await importar.confirmar(lote.id, u);
    assert.equal(result.turnos, 2);
    assert.equal(result.serviciosNuevos, 1);
    assert.deepEqual(await importar.confirmar(lote.id, u), result);
    const mc = await svc.resultado({ periodo: 'todos' });
    assert.ok(mc.tabla.some((x) => x.criterios.length === 5));
    assert.ok(
      (await c.query('SELECT COUNT(*)::int AS n FROM bi.hecho_turno')).rows[0]
        .n > 0
    );
    const app = require('../src/app'),
      server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    try {
      const url = 'http://127.0.0.1:' + server.address().port + '/api/v1';
      assert.equal((await fetch(url + '/multicriterio/resultado')).status, 401);
      const token = require('jsonwebtoken').sign(
          u,
          require('../src/config/env').JWT_SECRET
        ),
        headers = { Authorization: 'Bearer ' + token };
      const resp = await fetch(url + '/multicriterio/resultado?periodo=todos', {
        headers,
      });
      assert.equal(resp.status, 200);
      assert.ok((await resp.json()).datos.tabla.length);
      assert.equal(
        (await fetch(url + '/importaciones/plantilla', { headers })).status,
        200
      );
      assert.equal(
        (
          await fetch(
            url + '/turnos/semana?desde=2024-01-01&hasta=2024-01-05',
            { headers }
          )
        ).status,
        200
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
    console.log(
      'Integración OK: nocturnos, vacante, reasignación auditada, asistencia, SLA, importación atómica/idempotente, BI y API autenticada.'
    );
  } finally {
    pool.query = queryOriginal;
    pool.connect = connectOriginal;
    await c.query('ROLLBACK');
    c.release();
    await pool.end();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});

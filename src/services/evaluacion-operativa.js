'use strict';
const { ErrorValidacion } = require('../utils/errores');
const formatoFecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
const formatoHora = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Lima', hour: '2-digit', hourCycle: 'h23',
});
const fechaLocal = (d) => formatoFecha.format(new Date(d));
const franja = (d) => {
  const h = Number(
    formatoHora.format(new Date(d))
  );
  return h >= 6 && h < 18 ? 'diurno' : 'nocturno';
};
function filtros(query = {}, ahora = new Date()) {
  const periodo = String(query.periodo || '30'),
    turno = query.turno || 'ambos';
  if (
    !['3', '7', '30', 'todos'].includes(periodo) ||
    !['ambos', 'diurno', 'nocturno'].includes(turno)
  )
    throw new ErrorValidacion('Periodo o turno inválido');
  const servicios = String(query.servicios || query.servicioId || '')
    .split(',')
    .filter(Boolean)
    .map(Number);
  if (servicios.some((n) => !Number.isSafeInteger(n) || n <= 0))
    throw new ErrorValidacion('Servicios inválidos');
  const fin = new Date(ahora),
    inicio =
      periodo === 'todos'
        ? null
        : new Date(`${fechaLocal(fin)}T00:00:00-05:00`);
  if (inicio) inicio.setUTCDate(inicio.getUTCDate() - Number(periodo) + 1);
  return {
    periodo,
    turno,
    servicios,
    inicio: inicio?.toISOString() || null,
    fin: fin.toISOString(),
  };
}
function criterio(def, n, d, faltantes = 0) {
  const peso = Number(def.peso),
    umbral = Number(def.umbral);
  const tasa = d > 0 && faltantes === 0 ? (100 * n) / d : null;
  const riesgo =
    tasa === null ? null : Math.min(100, ((100 - tasa) / umbral) * 100);
  return {
    ...def,
    peso,
    umbral,
    numerador: n,
    denominador: d,
    faltantes,
    tasa,
    riesgo,
    aporte: riesgo === null ? null : riesgo * peso,
    estado: faltantes ? 'Faltan datos' : d === 0 ? 'Sin casos' : 'Evaluado',
  };
}
function calcular(turnos, incidencias, defs, corte) {
  const ahora = +new Date(corte),
    vencidos = turnos.filter((t) => +new Date(t.fin_programado) <= ahora);
  const iniciados = turnos.filter(
    (t) => +new Date(t.inicio_programado) <= ahora
  );
  const faltaAsistencia = (t) => t.personal_id && !t.asistencia_validada;
  const cumple = vencidos.filter(
    (t) =>
      t.asistencia_validada &&
      t.ingreso_real &&
      t.salida_real &&
      t.estado === 'cumplido' &&
      +new Date(t.ingreso_real) < +new Date(t.fin_programado) &&
      +new Date(t.salida_real) >= +new Date(t.fin_programado)
  ).length;
  const presencias = iniciados.filter(
    (t) =>
      t.personal_id &&
      t.asistencia_validada &&
      t.ingreso_real &&
      +new Date(t.ingreso_real) <= ahora &&
      +new Date(t.ingreso_real) < +new Date(t.fin_programado)
  );
  const puntuales = presencias.filter(
    (t) =>
      +new Date(t.ingreso_real) <=
      +new Date(t.inicio_programado) + t.tolerancia_min * 60000
  ).length;
  const obligaciones = turnos.filter(
    (t) => +new Date(t.evidencia_limite || t.fin_programado) <= ahora
  );
  const faltaEv = obligaciones.filter(
    (t) =>
      t.evidencias_requeridas === null ||
      (t.evidencias_requeridas > 0 &&
        (t.evidencias_registradas === null || !t.evidencia_limite))
  ).length;
  let requeridas = 0,
    registradas = 0;
  for (const t of obligaciones) {
    requeridas += t.evidencias_requeridas || 0;
    let declaradasEnPlazo = 0;
    if (
      t.evidencia_registro &&
      +new Date(t.evidencia_registro) <= +new Date(t.evidencia_limite)
    )
      declaradasEnPlazo = Math.min(
        t.evidencias_requeridas || 0,
        t.evidencias_registradas || 0
      );
    registradas += Math.min(
      t.evidencias_requeridas || 0,
      Math.max(declaradasEnPlazo, t.evidencias_vinculadas_en_plazo || 0)
    );
  }
  const faltaSla = incidencias.filter((i) => !i.sla_min).length;
  const elegibles = incidencias.filter(
    (i) =>
      i.sla_min &&
      (i.fecha_atencion ||
        +new Date(i.fecha_registro) + i.sla_min * 60000 <= ahora)
  );
  const oportunas = elegibles.filter(
    (i) =>
      i.fecha_atencion &&
      +new Date(i.fecha_atencion) - +new Date(i.fecha_registro) <=
        i.sla_min * 60000
  ).length;
  const sinProgramacion = turnos.length ? 0 : 1;
  const c = [
    criterio(
      defs[0],
      cumple,
      vencidos.length,
      vencidos.filter(faltaAsistencia).length + sinProgramacion
    ),
    criterio(
      defs[1],
      puntuales,
      presencias.length,
      iniciados.filter(faltaAsistencia).length + sinProgramacion
    ),
    criterio(
      defs[2],
      presencias.length,
      iniciados.length,
      iniciados.filter(faltaAsistencia).length + sinProgramacion
    ),
    criterio(defs[3], registradas, requeridas, faltaEv),
    criterio(defs[4], oportunas, elegibles.length, faltaSla),
  ];
  // Sin obligaciones/casos no hay desviación si la fuente está completa; nunca sustituye faltantes.
  for (const x of c)
    if (!x.faltantes && !x.denominador) {
      x.riesgo = 0;
      x.aporte = 0;
      x.estado = 'Sin casos';
    }
  const completo = c.every((x) => x.aporte !== null),
    puntaje = completo ? c.reduce((s, x) => s + x.aporte, 0) : null;
  return {
    criterios: c,
    puntaje,
    nivel:
      puntaje === null
        ? 'sin_datos'
        : puntaje >= 60
          ? 'alta'
          : puntaje >= 30
            ? 'media'
            : 'baja',
    completo,
    turnos: turnos.length,
    sin_cubrir: iniciados.filter(
      (t) =>
        !t.personal_id ||
        t.relevo_pendiente ||
        (t.asistencia_validada &&
          (!t.ingreso_real ||
            +new Date(t.ingreso_real) >= +new Date(t.fin_programado)))
    ).length,
    pendientes: incidencias.filter((i) => i.estado !== 'cerrada').length,
  };
}
function evaluarFuentes(data, query = {}) {
  const f = filtros(query, data.corte),
    desde = f.inicio ? +new Date(f.inicio) : -Infinity,
    hasta = +new Date(f.fin);
  const servicios = data.servicios.filter(
    (s) => !f.servicios.length || f.servicios.includes(s.id)
  );
  const ids = new Set(servicios.map((s) => s.id)),
    porTurno = new Map(data.turnos.map((t) => [t.id, t]));
  const ts = data.turnos.filter(
    (t) =>
      ids.has(t.servicio_id) &&
      +new Date(t.inicio_programado) >= desde &&
      +new Date(t.inicio_programado) <= hasta &&
      (f.turno === 'ambos' || franja(t.inicio_programado) === f.turno)
  );
  const inc = data.incidencias.filter(
    (i) =>
      ids.has(i.servicio_id) &&
      +new Date(i.fecha_registro) >= desde &&
      +new Date(i.fecha_registro) <= hasta &&
      (f.turno === 'ambos' ||
        franja(
          porTurno.get(i.turno_id)?.inicio_programado || i.fecha_registro
        ) === f.turno)
  );
  const tabla = servicios
    .map((s) => ({
      ...s,
      servicio_id: s.id,
      servicio: s.nombre,
      ...calcular(
        ts.filter((t) => t.servicio_id === s.id),
        inc.filter((i) => i.servicio_id === s.id),
        data.criterios,
        f.fin
      ),
    }))
    .sort(
      (a, b) =>
        (b.puntaje ?? -1) - (a.puntaje ?? -1) ||
        a.nombre.localeCompare(b.nombre)
    );
  const dias = [
    ...new Set([
      ...ts.map((t) => t.dia),
      ...inc.map((i) => fechaLocal(i.fecha_registro)),
    ]),
  ].sort();
  const evolucion = dias.map((dia) => ({
    id: dia,
    dia,
    ...calcular(
      ts.filter((t) => t.dia === dia),
      inc.filter((i) => fechaLocal(i.fecha_registro) === dia),
      data.criterios,
      f.fin
    ),
  }));
  const criticas = inc
    .filter((i) => i.estado !== 'cerrada')
    .sort(
      (a, b) =>
        ({ alta: 0, media: 1, baja: 2 })[a.prioridad] -
          { alta: 0, media: 1, baja: 2 }[b.prioridad] ||
        new Date(a.fecha_registro) - new Date(b.fecha_registro)
    );
  return {
    version: 'operativo-v2',
    demo: Boolean(data.demo),
    demo_generada_en: data.demo_generada_en || null,
    filtros: f,
    criterios: data.criterios,
    tabla,
    evolucion,
    criticas: criticas.slice(0, 30),
    resumen: {
      evaluados: tabla.filter((s) => s.completo).length,
      alta: tabla.filter((s) => s.nivel === 'alta').length,
      pendientes: inc.filter((i) => i.estado !== 'cerrada').length,
      sin_cubrir: tabla.reduce((n, s) => n + s.sin_cubrir, 0),
      total: tabla.length,
    },
    pendientes_al_corte: data.incidencias.filter(
      (i) =>
        ids.has(i.servicio_id) &&
        i.estado !== 'cerrada' &&
        +new Date(i.fecha_registro) <= hasta &&
        (f.turno === 'ambos' ||
          franja(
            porTurno.get(i.turno_id)?.inicio_programado || i.fecha_registro
          ) === f.turno)
    ).length,
  };
}
module.exports = {
  filtros,
  criterio,
  calcular,
  evaluarFuentes,
  fechaLocal,
  franja,
};

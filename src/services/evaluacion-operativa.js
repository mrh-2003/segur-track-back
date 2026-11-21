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
  const h = Number(formatoHora.format(new Date(d)));
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
function kpiTasa(n, d) {
  if (d === 0) return { numerador: n, denominador: d, tasa: null };
  return { numerador: n, denominador: d, tasa: (100 * n) / d };
}
function criterio(def, kpi01n, kpi01d, kpi02n, kpi02d, faltantes = 0) {
  const peso = Number(def.peso),
    umbral = Number(def.umbral || 20);
  const kpi01 = kpiTasa(kpi01n, kpi01d);
  const kpi02 = kpiTasa(kpi02n, kpi02d);
  const tasasDisponibles = [kpi01.tasa, kpi02.tasa].filter((t) => t !== null);
  const tasa =
    faltantes > 0
      ? null
      : tasasDisponibles.length > 0
        ? tasasDisponibles.reduce((s, v) => s + v, 0) / tasasDisponibles.length
        : null;
  const riesgo =
    tasa === null ? null : Math.min(100, ((100 - tasa) / umbral) * 100);
  const estado =
    faltantes > 0
      ? 'Faltan datos'
      : kpi01d === 0 && kpi02d === 0
        ? 'Sin casos'
        : 'Evaluado';
  return {
    ...def,
    peso,
    umbral,
    kpi01,
    kpi02,
    tasa,
    riesgo,
    aporte: riesgo === null ? null : riesgo * peso,
    faltantes,
    estado,
    numerador: kpi01n + kpi02n,
    denominador: kpi01d + kpi02d,
  };
}
function calcular(turnos, incidencias, defs, corte, fuentes = {}) {
  const ahora = +new Date(corte),
    vencidos = turnos.filter((t) => +new Date(t.fin_programado) <= ahora);
  const conAsistencia = vencidos.filter(
    (t) => t.asistencia_validada && t.ingreso_real && +new Date(t.ingreso_real) < +new Date(t.fin_programado)
  );
  const puntuales = conAsistencia.filter(
    (t) =>
      +new Date(t.ingreso_real) <=
      +new Date(t.inicio_programado) + (t.tolerancia_min || 0) * 60000
  );
  const kpi01n = conAsistencia.length,
    kpi01d = vencidos.length;
  const kpi02n = puntuales.length,
    kpi02d = conAsistencia.length;
  const ids = new Set(turnos.map((t) => t.id));
  const enCorte = (v) => v && Number.isFinite(+new Date(v)) && +new Date(v) <= ahora;
  const vinculadas = (lista) => Array.isArray(lista) ? lista.filter((v) => ids.has(v.turno_id) && !v.eliminado) : null;
  const revisiones = vinculadas(fuentes.evidenciasServicio);
  const realizadas = (revisiones || []).filter((e) => e.protocolo_id && enCorte(e.fecha_revision) && ['aprobada', 'observada'].includes(e.estado_revision));
  const conformes = realizadas.filter((e) => e.conforme === true || (e.conforme == null && e.estado_revision === 'aprobada'));
  const verificaciones = vinculadas(fuentes.verificacionesConsignas);
  const verificadas = (verificaciones || []).filter((v) => enCorte(v.creado_en));
  const obligaciones = vinculadas(fuentes.obligaciones);
  const exigibles = (obligaciones || []).filter((v) => enCorte(v.fecha_limite));
  const actividades = exigibles.filter((v) => v.tipo === 'actividad');
  const reportes = exigibles.filter((v) => v.tipo === 'reporte').map(v=>({...v,fecha_completada:v.primera_entrega_en||v.fecha_completada}));
  const rondas = vinculadas(fuentes.rondas);
  const rondasExigibles = (rondas || []).filter((v) => enCorte(v.fecha_programada));
  const planFaltante = turnos.filter((t) => enCorte(t.inicio_programado) && !t.plan_kpi_validado).length;
  const completadas = (lista) => lista.filter((v) => enCorte(v.fecha_completada)).length;
  const plazos = (campo, fecha) => incidencias.filter((i) => Number(i[campo]) > 0 &&
    (enCorte(i[fecha]) || (campo==='sla_resolucion_min'&&i.plazo_resolucion_extendido ? +new Date(i.plazo_resolucion_extendido) : +new Date(i.fecha_registro) + Number(i[campo]) * 60000) <= ahora));
  const resolucion = plazos('sla_resolucion_min', 'fecha_cierre');
  const atencion = plazos('sla_min', 'fecha_atencion');
  const c = [
    criterio(defs[0], kpi01n, kpi01d, kpi02n, kpi02d,
      vencidos.filter((t) => t.personal_id && !t.asistencia_validada).length),
    criterio(defs[1], conformes.length, realizadas.length,
      verificadas.filter((v) => v.cumplida === true).length, verificadas.length,
      Number(revisiones === null) + Number(verificaciones === null)),
    criterio(defs[2], completadas(actividades), actividades.length,
      completadas(rondasExigibles.filter((r) => r.estado === 'completada')), rondasExigibles.length,
      planFaltante + Number(obligaciones === null) + Number(rondas === null)),
    criterio(defs[3], completadas(reportes), reportes.length,
      reportes.filter((r) => enCorte(r.fecha_completada) && +new Date(r.fecha_completada) <= +new Date(r.fecha_limite)).length, reportes.length,
      planFaltante + Number(obligaciones === null)),
    criterio(defs[4], resolucion.filter((i) => i.estado === 'cerrada' && enCorte(i.fecha_cierre)).length, resolucion.length,
      atencion.filter((i) => enCorte(i.fecha_atencion) && +new Date(i.fecha_atencion) <= +new Date(i.fecha_registro) + Number(i.sla_min) * 60000).length, atencion.length,
      incidencias.filter((i) => !(Number(i.sla_min) > 0) || !(Number(i.sla_resolucion_min) > 0) || (i.estado === 'cerrada' && !i.fecha_cierre)).length),
  ];
  const observaciones = [
    'Valide la asistencia de los turnos vencidos asignados, incluida la inasistencia.',
    'Compruebe la disponibilidad de las verificaciones de protocolos y consignas.',
    'Configure el plan operativo en Servicios y registre actividades y rondas en el detalle de Turnos.',
    'Configure los reportes en el plan de Servicios y entregue su contenido desde el detalle de Turnos.',
    'Defina los plazos de atención y resolución en Incidencias y registre atención/cierre.',
  ];
  c.forEach((x,i) => { x.observaciones = x.faltantes ? observaciones[i] : null; });
  for (const x of c)
    if (!x.faltantes && x.kpi01.denominador === 0 && x.kpi02.denominador === 0) {
      x.riesgo = 0;
      x.aporte = 0;
      x.estado = 'Sin casos';
    }
  const sinProgramacion = turnos.length === 0;
  const completo = !sinProgramacion && c.every((x) => x.aporte !== null);
  const criticidad = completo ? c.reduce((s, x) => s + x.aporte, 0) : null;
  const puntaje = criticidad;
  const iniciados = turnos.filter(
    (t) => +new Date(t.inicio_programado) <= ahora
  );
  return {
    criterios: c,
    puntaje,
    criticidad,
    nivel:
      criticidad === null
        ? 'sin_datos'
        : criticidad >= 60
          ? 'alta'
          : criticidad >= 30
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
    porTurno = new Map((data.turnosReferencia || data.turnos).map((t) => [t.id, t]));
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
  const fuentes = {
    verificacionesConsignas: data.verificacionesConsignas || null,
    rondas: data.rondas || null,
    evidenciasServicio: data.evidenciasServicio ?? null,
    obligaciones: data.obligaciones ?? null,
  };
  const tabla = servicios
    .map((s) => ({
      ...s,
      servicio_id: s.id,
      servicio: s.nombre,
      ...calcular(
        ts.filter((t) => t.servicio_id === s.id),
        inc.filter((i) => i.servicio_id === s.id),
        data.criterios,
        f.fin,
        {
          verificacionesConsignas: fuentes.verificacionesConsignas
            ? fuentes.verificacionesConsignas.filter(
                (v) => ts.some((t) => t.servicio_id === s.id && t.id === v.turno_id)
              )
            : null,
          rondas: fuentes.rondas
            ? fuentes.rondas.filter(
                (r) => r.servicio_id === s.id
              )
            : null,
          obligaciones: fuentes.obligaciones,
          evidenciasServicio: fuentes.evidenciasServicio?.filter(
            (e) => e.servicio_id === s.id
          ) ?? null,
        }
      ),
    }))
    .sort(
      (a, b) =>
        (b.criticidad ?? -1) - (a.criticidad ?? -1) ||
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
      f.fin,
      fuentes
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
    version: 'operativo-v4',
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

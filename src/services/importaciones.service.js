'use strict';
const ExcelJS = require('exceljs');
const crypto = require('crypto');
const pool = require('../config/db');
const tx = require('../utils/transaccion');
const {
  ErrorValidacion,
  ErrorConflicto,
  ErrorNoEncontrado,
} = require('../utils/errores');
const { disponible } = require('./operacion.service');
const originales = [
  'Empresa',
  'Cliente/Almacen',
  'Solicitante',
  'ORDEN/ SLP/ TGL/ CODIGO',
  'Placa de Resguardo',
  'RESGUARDO',
  'MODALIDAD DE RESGUARDO',
  'Transporte',
  'Placa Custodiada',
  'Contenedor',
  'Fecha',
  'Hra. De Solicitud Efectivo Policial',
  'Hra. De instalacion',
  'Hra. De Inicio',
  'Fecha de llagada',
  'Hra. Llegada',
  'H. Term.',
  'TOTAL HRS. TRABAJADAS',
  'PUNTO INICIO',
  'PUNTO FINAL',
  'Observacion',
];
const adicionales = [
  'Codigo servicio',
  'Codigo turno',
  'DNI',
  'Nombres',
  'Apellidos',
  'Sede',
  'Supervisor DNI',
  'Puesto',
  'Inicio programado',
  'Fin programado',
  'Ingreso real',
  'Salida real',
  'Asistencia validada',
  'Estado turno',
  'Evidencias requeridas',
  'Evidencias registradas',
  'Limite evidencias',
  'Fecha registro evidencias',
  'Tolerancia minutos',
];
const normalizar = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const texto = (v) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if ('formula' in v || 'sharedFormula' in v) return texto(v.result);
    if (v.richText) return v.richText.map((x) => x.text).join('');
    if (v.text) return v.text;
    return '';
  }
  return String(v).trim();
};
const timestamp = (v) => {
  if (!v) return null;
  if (v instanceof Date) {
    const s = v.toISOString().slice(0, 19);
    return new Date(s + '-05:00').toISOString();
  }
  const s = texto(v).replace(' ', 'T');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?$/.test(s))
    throw new Error('Use fecha y hora YYYY-MM-DD HH:mm');
  const local = s.replace(/(Z|[+-]\d{2}:\d{2})$/, '');
  const d = new Date(s + (/(Z|[+-]\d{2}:\d{2})$/.test(s) ? '' : '-05:00'));
  if (
    !Number.isFinite(+d) ||
    Number(local.slice(5, 7)) > 12 ||
    Number(local.slice(5, 7)) < 1 ||
    Number(local.slice(8, 10)) < 1 ||
    Number(local.slice(11, 13)) > 23 ||
    Number(local.slice(14, 16)) > 59 ||
    Number(local.slice(8, 10)) >
      new Date(
        Date.UTC(Number(local.slice(0, 4)), Number(local.slice(5, 7)), 0)
      ).getUTCDate()
  )
    throw new Error('Fecha inválida');
  return d.toISOString();
};
async function plantilla() {
  const w = new ExcelJS.Workbook(),
    s = w.addWorksheet('Tareaje');
  s.addRow([...originales, ...adicionales]);
  s.views = [{ state: 'frozen', ySplit: 1 }];
  s.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  s.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' },
  };
  s.columns.forEach((c) => {
    c.width = 25;
  });
  const guia = w.addWorksheet('Instrucciones');
  const lines = [
    'Una fila por plaza-turno. Repetir Codigo servicio para conductor/cabinero de una misma custodia.',
    'Obligatorios: Empresa, Codigo servicio, Codigo turno, Sede, Supervisor DNI, Puesto, Inicio programado, Fin programado, Estado turno, Evidencias requeridas.',
    'DNI obligatorio para personal asignado. Nombres y Apellidos obligatorios al crear una persona. Correo no se inventa; completar luego en Personal.',
    'Supervisor DNI debe existir como supervisor o jefe de operaciones. Se crean clientes y sedes por nombre exacto normalizado.',
    'Fecha-hora: YYYY-MM-DD HH:mm, zona America/Lima. Inicio/Fin programados incluyen fecha completa para turnos nocturnos.',
    'Estado turno: sin_confirmar, confirmado, pendiente, cumplido o sin_asignar. Sin_asignar representa demanda sin personal.',
    'Asistencia validada: SI/NO. Con SI y sin Ingreso real se registra ausencia comprobada. Cumplido requiere ingreso, salida y validación.',
    'Evidencias requeridas: entero >=0. Si >0, completar Limite evidencias y Evidencias registradas (incluido 0). Si registradas >0, Fecha registro evidencias es obligatoria.',
    'Los contadores históricos son declaraciones verificadas por quien importa; las fotos se adjuntan desde Turnos. No se crean fotos ficticias.',
    'Tolerancia minutos: 0..120; valor inicial 10. Los campos operativos faltantes dejan el criterio no evaluable hasta completarlos.',
    'Mantener las 21 columnas originales. Solo se expanden celdas realmente combinadas. Las filas con solo fórmulas se ignoran.',
    'TOTAL HRS. TRABAJADAS se conserva como referencia, no sustituye horarios programados ni marcaciones reales.',
    'Codigo turno identifica un hecho y no debe repetirse. Los ya importados no se sobrescriben: corregir en Turnos con motivo e historial.',
    'Empresa es el contratante (p.ej. MAERSK). Cliente/Almacen (p.ej. TECNOFIL) se conserva como entidad atendida, no como contratante.',
    'Observacion se conserva literalmente; no crea automáticamente incidencias ni altera horas reales por indicaciones de facturación.',
    'Las incidencias se registran en su módulo: tipo, prioridad, responsable y SLA. El tareaje solo no permite reconstruirlas.',
  ];
  lines.forEach((t) => guia.addRow([t]));
  guia.getColumn(1).width = 120;
  guia.eachRow((r) => {
    r.alignment = { wrapText: true };
    r.height = 34;
  });
  return w.xlsx.writeBuffer();
}
async function analizar(buffer) {
  const w = new ExcelJS.Workbook();
  try {
    await w.xlsx.load(buffer);
  } catch {
    throw new ErrorValidacion('No se pudo leer el archivo XLSX');
  }
  const s =
    w.getWorksheet('Tareaje') ||
    w.getWorksheet('SEPTIEMBRE') ||
    w.worksheets[0];
  if (!s || s.rowCount > 10001 || s.columnCount > 100)
    throw new ErrorValidacion(
      'El archivo debe tener hasta 10.000 filas y 100 columnas'
    );
  const headers = new Map(),
    errores = [],
    advertencias = [],
    filas = [];
  s.getRow(1).eachCell((c, n) => {
    const key = normalizar(texto(c.value));
    if (headers.has(key))
      errores.push({
        fila: 1,
        columna: c.address,
        mensaje: 'Encabezado duplicado',
      });
    headers.set(key, n);
  });
  for (const col of [
    'Empresa',
    'Codigo servicio',
    'Codigo turno',
    'Sede',
    'Supervisor DNI',
    'Puesto',
    'Inicio programado',
    'Fin programado',
    'Estado turno',
    'Evidencias requeridas',
  ])
    if (!headers.has(normalizar(col)))
      errores.push({
        fila: 1,
        columna: col,
        mensaje: 'Falta columna obligatoria',
      });
  const personas = (
    await pool.query('SELECT * FROM personal WHERE NOT eliminado')
  ).rows;
  const codigos = new Set(),
    servicios = new Map(),
    firmasPersonal = new Map();
  for (let n = 2; n <= s.rowCount; n++) {
    const row = s.getRow(n),
      raw = {};
    let tieneDatos = false;
    for (const [key, col] of headers) {
      const cell = row.getCell(col);
      raw[key] = cell.value;
      if (key !== normalizar('TOTAL HRS. TRABAJADAS') && texto(cell.value))
        tieneDatos = true;
    }
    if (!tieneDatos) continue;
    const get = (nombre) => raw[normalizar(nombre)],
      str = (nombre) => texto(get(nombre));
    const error = (col, mensaje) =>
      errores.push({
        fila: n,
        columna: headers.has(normalizar(col))
          ? row.getCell(headers.get(normalizar(col))).address
          : col,
        mensaje,
      });
    const req = (col) => {
      const v = str(col);
      if (!v) error(col, 'Dato obligatorio');
      return v;
    };
    const fecha = (col, obligatoria = false) => {
      try {
        const v = timestamp(get(col));
        if (obligatoria && !v) error(col, 'Fecha y hora obligatorias');
        return v;
      } catch (e) {
        error(col, e.message);
        return null;
      }
    };
    const entero = (col, def = null) => {
      const v = str(col);
      if (!v) return def;
      const number = Number(v);
      if (!Number.isInteger(number) || number < 0 || number > 1000) {
        error(col, 'Use un entero entre 0 y 1000');
        return null;
      }
      return number;
    };
    const d = {
      fila: n,
      empresa: req('Empresa'),
      codigoServicio: req('Codigo servicio'),
      codigoTurno: req('Codigo turno'),
      sede: req('Sede'),
      supervisor: req('Supervisor DNI'),
      puesto: req('Puesto'),
      dni: str('DNI'),
      nombres: str('Nombres'),
      apellidos: str('Apellidos'),
      inicio: fecha('Inicio programado', true),
      fin: fecha('Fin programado', true),
      ingreso: fecha('Ingreso real'),
      salida: fecha('Salida real'),
      validada: normalizar(str('Asistencia validada')) === 'si',
      estado: req('Estado turno'),
      requeridas: entero('Evidencias requeridas'),
      registradas: entero('Evidencias registradas'),
      limite: fecha('Limite evidencias'),
      registro: fecha('Fecha registro evidencias'),
      tolerancia: entero('Tolerancia minutos', 10),
      original: Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k, texto(v)])
      ),
    };
    if (d.requeridas === null)
      error(
        'Evidencias requeridas',
        'Indique cuántas evidencias se exigen (incluido 0)'
      );
    if (d.tolerancia > 120) error('Tolerancia minutos', 'Máximo 120 minutos');
    if (
      ![
        'sin_confirmar',
        'confirmado',
        'pendiente',
        'cumplido',
        'sin_asignar',
        'programado',
      ].includes(d.estado)
    )
      error('Estado turno', 'Estado no válido');
    if (d.estado !== 'sin_asignar' && !/^\d{8}$/.test(d.dni))
      error('DNI', 'Se requiere DNI de ocho dígitos para el personal asignado');
    if (d.estado === 'sin_asignar' && d.dni)
      error('DNI', 'Una plaza sin asignar debe tener DNI vacío');
    const existentes = personas.filter((p) => p.documento === d.dni);
    if (d.dni && !existentes.length && (!d.nombres || !d.apellidos))
      error('Nombres', 'Complete nombres y apellidos de la nueva persona');
    if (existentes.some((p) => p.estado !== 'activo'))
      error('DNI', 'Personal inactivo');
    if (d.dni && d.nombres && d.apellidos) {
      const firma = normalizar(d.nombres + d.apellidos);
      if (firmasPersonal.has(d.dni) && firmasPersonal.get(d.dni) !== firma)
        error('DNI', 'El mismo DNI tiene nombres diferentes');
      firmasPersonal.set(d.dni, firma);
    }
    if (
      !personas.some(
        (p) =>
          p.documento === d.supervisor &&
          p.estado === 'activo' &&
          ['supervisor', 'jefe_operaciones'].includes(p.cargo)
      )
    )
      error(
        'Supervisor DNI',
        'Debe existir como supervisor o jefe de operaciones activo'
      );
    if (
      d.inicio &&
      d.fin &&
      +new Date(d.fin) - +new Date(d.inicio) > 24 * 3600000
    )
      error('Fin programado', 'Divida los turnos de más de 24 horas');
    if (d.inicio && d.fin && d.fin <= d.inicio)
      error('Fin programado', 'Debe ser posterior al inicio');
    if (d.salida && (!d.ingreso || d.salida <= d.ingreso))
      error('Salida real', 'Debe ser posterior al ingreso');
    if (
      (d.ingreso && +new Date(d.ingreso) > Date.now()) ||
      (d.salida && +new Date(d.salida) > Date.now())
    )
      error('Ingreso real', 'No se permiten marcaciones futuras');
    if (d.estado === 'cumplido' && (!d.validada || !d.ingreso || !d.salida))
      error(
        'Estado turno',
        'Cumplido requiere asistencia validada, ingreso y salida'
      );
    if (d.requeridas > 0 && (!d.limite || d.registradas === null))
      error(
        'Limite evidencias',
        'Complete límite y cantidad registrada; use 0 si faltaron'
      );
    if (d.registradas > 0 && !d.registro)
      error(
        'Fecha registro evidencias',
        'Dato obligatorio cuando existen evidencias'
      );
    if (d.registro && +new Date(d.registro) > Date.now())
      error('Fecha registro evidencias', 'No puede ser futura');
    if (
      str('Asistencia validada') &&
      !['si', 'no'].includes(normalizar(str('Asistencia validada')))
    )
      error('Asistencia validada', 'Use SI o NO');
    if (!d.validada)
      advertencias.push({
        fila: n,
        mensaje:
          'Asistencia no validada: completar en Turnos para evaluar cumplimiento, puntualidad y cobertura',
      });
    if (codigos.has(d.codigoTurno))
      error('Codigo turno', 'Código repetido dentro del archivo');
    codigos.add(d.codigoTurno);
    const firmaServicio =
      normalizar(d.empresa) + '|' + normalizar(d.sede) + '|' + d.supervisor;
    if (
      servicios.has(d.codigoServicio) &&
      servicios.get(d.codigoServicio) !== firmaServicio
    )
      error(
        'Codigo servicio',
        'El mismo servicio tiene cliente, sede o supervisor diferentes'
      );
    servicios.set(d.codigoServicio, firmaServicio);
    filas.push(d);
  }
  if (!filas.length)
    errores.push({
      fila: 1,
      columna: 'Hoja',
      mensaje: 'No se encontraron filas operativas',
    });
  const claves = filas.map((d) => d.codigoTurno).filter(Boolean);
  const existentes = (
    await pool.query(
      'SELECT clave_importacion FROM turnos WHERE clave_importacion=ANY($1::text[])',
      [claves]
    )
  ).rows;
  for (const e of existentes) {
    const f = filas.find((d) => d.codigoTurno === e.clave_importacion);
    errores.push({
      fila: f.fila,
      columna: 'Codigo turno',
      mensaje: 'Ya importado: corregir en Turnos para conservar historial',
    });
  }
  const asignadas = filas.filter((d) => d.dni && d.inicio && d.fin);
  for (let i = 0; i < asignadas.length; i++)
    for (let j = i + 1; j < asignadas.length; j++) {
      const a = asignadas[i],
        b = asignadas[j];
      if (a.dni === b.dni && a.inicio < b.fin && a.fin > b.inicio)
        errores.push({
          fila: b.fila,
          columna: 'DNI',
          mensaje: `Horario solapado con fila ${a.fila}`,
        });
    }
  return { filas, errores, advertencias, hoja: s.name };
}
async function preparar(d, u) {
  if (
    !/\.xlsx$/i.test(d.nombre) ||
    typeof d.base64 !== 'string' ||
    d.base64.length > 12 * 1024 * 1024
  )
    throw new ErrorValidacion('Seleccione un XLSX de hasta 8 MB');
  const buffer = Buffer.from(d.base64, 'base64'),
    huella = crypto.createHash('sha256').update(buffer).digest('hex');
  const previo = (
    await pool.query('SELECT * FROM importaciones WHERE huella=$1', [huella])
  ).rows[0];
  if (previo) {
    if (previo.usuario_id !== u.id)
      throw new ErrorConflicto(
        'Este archivo ya tiene un lote registrado por otro usuario'
      );
    return {
      ...previo.datos,
      id: previo.id,
      estado: previo.estado,
      resultado: previo.resultado,
    };
  }
  const datos = await analizar(buffer);
  const id = (
    await pool.query(
      'INSERT INTO importaciones(huella,nombre,usuario_id,datos,archivo) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [huella, d.nombre, u.id, datos, buffer]
    )
  ).rows[0].id;
  return { ...datos, id, estado: 'preparado' };
}
async function buscarCrear(c, tabla, nombre) {
  const cols = {
    clientes: 'nombre',
    sedes: 'nombre',
    ubicaciones_operativas: 'nombre',
    transportistas: 'nombre',
    vehiculos: 'placa',
    contenedores: 'codigo',
  };
  const col = cols[tabla];
  if (!col) throw new Error('Catálogo inválido');
  const filtro = ['clientes', 'sedes'].includes(tabla)
    ? ' AND NOT eliminado'
    : '';
  const valor = nombre.trim().replace(/\s+/g, ' ');
  const found = (
    await c.query(
      `SELECT id FROM ${tabla} WHERE LOWER(REGEXP_REPLACE(TRIM(${col}),'\\s+',' ','g'))=LOWER($1)${filtro}`,
      [valor]
    )
  ).rows;
  if (found.length > 1)
    throw new ErrorConflicto(`Nombre ambiguo en ${tabla}: ${valor}`);
  if (found.length) return found[0].id;
  return (
    await c.query(`INSERT INTO ${tabla}(${col}) VALUES($1) RETURNING id`, [
      valor,
    ])
  ).rows[0].id;
}
async function confirmar(id, u) {
  return tx(u.id, 'Importación de tareaje verificado', async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(741093)');
    const lote = (
      await c.query(
        'SELECT * FROM importaciones WHERE id=$1 AND usuario_id=$2 FOR UPDATE',
        [id, u.id]
      )
    ).rows[0];
    if (!lote) throw new ErrorNoEncontrado('Lote no encontrado');
    if (lote.estado === 'importado') return lote.resultado;
    if (lote.datos.errores.length)
      throw new ErrorValidacion(
        'Corrija los errores y vuelva a subir el archivo'
      );
    let turnos = 0,
      serviciosNuevos = 0,
      personalNuevo = 0;
    const cache = new Map();
    for (const d of lote.datos.filas) {
      const cliente = await buscarCrear(c, 'clientes', d.empresa),
        sede = await buscarCrear(c, 'sedes', d.sede);
      const supervisor = (
        await c.query(
          "SELECT id FROM personal WHERE documento=$1 AND NOT eliminado AND estado='activo' AND cargo IN ('supervisor','jefe_operaciones')",
          [d.supervisor]
        )
      ).rows[0];
      if (!supervisor)
        throw new ErrorConflicto('El supervisor ya no está disponible');
      let servicio = cache.get(d.codigoServicio);
      if (!servicio) {
        const existente = (
          await c.query(
            'SELECT * FROM servicios WHERE codigo_externo=$1 AND NOT eliminado',
            [d.codigoServicio]
          )
        ).rows[0];
        if (
          existente &&
          (existente.cliente_id !== cliente ||
            existente.sede_id !== sede ||
            existente.supervisor_id !== supervisor.id)
        )
          throw new ErrorConflicto(
            'El servicio existente tiene otros datos maestros'
          );
        if (existente) servicio = existente.id;
        else {
          const grupo = lote.datos.filas.filter(
              (f) => f.codigoServicio === d.codigoServicio
            ),
            inicio = grupo.map((f) => f.inicio).sort()[0],
            fin = grupo
              .map((f) => f.fin)
              .sort()
              .at(-1);
          const local = (v) =>
            new Date(+new Date(v) - 5 * 3600000).toISOString();
          servicio = (
            await c.query(
              `INSERT INTO servicios(nombre,codigo_externo,cliente_id,sede_id,supervisor_id,hora_inicio,hora_fin,fecha_inicio,fecha_fin,estado) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
              [
                `${d.empresa} · ${d.codigoServicio}`,
                d.codigoServicio,
                cliente,
                sede,
                supervisor.id,
                local(inicio).slice(11, 19),
                local(fin).slice(11, 19),
                local(inicio).slice(0, 10),
                local(fin).slice(0, 10),
                +new Date(fin) < Date.now() ? 'finalizado' : 'programado',
              ]
            )
          ).rows[0].id;
          serviciosNuevos++;
        }
        cache.set(d.codigoServicio, servicio);
        const o = d.original,
          origen = o[normalizar('PUNTO INICIO')],
          destino = o[normalizar('PUNTO FINAL')],
          transporte = o[normalizar('Transporte')];
        await c.query(
          `INSERT INTO servicio_custodias(servicio_id,cliente_almacen,solicitante,referencias,transportista_id,origen_id,destino_id,hitos,observacion) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
          [
            servicio,
            o[normalizar('Cliente/Almacen')] || null,
            o.solicitante || null,
            o[normalizar('ORDEN/ SLP/ TGL/ CODIGO')] || null,
            transporte
              ? await buscarCrear(c, 'transportistas', transporte)
              : null,
            origen
              ? await buscarCrear(c, 'ubicaciones_operativas', origen)
              : null,
            destino
              ? await buscarCrear(c, 'ubicaciones_operativas', destino)
              : null,
            o,
            o.observacion || null,
          ]
        );
      }
      let persona = null;
      if (d.dni) {
        persona = (
          await c.query(
            'SELECT id FROM personal WHERE documento=$1 AND NOT eliminado',
            [d.dni]
          )
        ).rows[0]?.id;
        if (!persona) {
          persona = (
            await c.query(
              "INSERT INTO personal(nombres,apellidos,documento,cargo,sede_id) VALUES($1,$2,$3,'agente',$4) RETURNING id",
              [d.nombres, d.apellidos, d.dni, sede]
            )
          ).rows[0].id;
          personalNuevo++;
        }
        try {
          await disponible(c, persona, d.inicio, d.fin);
        } catch (e) {
          throw new ErrorConflicto(`Fila ${d.fila}: ${e.message}`);
        }
        if (
          !(
            await c.query(
              'SELECT id FROM servicio_personal WHERE servicio_id=$1 AND personal_id=$2 AND NOT eliminado',
              [servicio, persona]
            )
          ).rowCount
        )
          await c.query(
            'INSERT INTO servicio_personal(servicio_id,personal_id) VALUES($1,$2)',
            [servicio, persona]
          );
      }
      const local = (v) => new Date(+new Date(v) - 5 * 3600000).toISOString();
      // El modelo actual admite un máximo de 24 horas por plaza-turno.
      if (+new Date(d.fin) - +new Date(d.inicio) > 24 * 3600000)
        throw new ErrorValidacion(
          `Fila ${d.fila}: divida turnos mayores de 24 horas`
        );
      const creado = await c.query(
        `INSERT INTO turnos(personal_id,servicio_id,sede_id,fecha,hora_inicio,hora_fin,estado,creado_por,puesto,funcion,ingreso_real,salida_real,asistencia_validada,tolerancia_min,evidencias_requeridas,evidencias_registradas,evidencia_limite,evidencia_registro,clave_importacion)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
        [
          persona,
          servicio,
          sede,
          local(d.inicio).slice(0, 10),
          local(d.inicio).slice(11, 19),
          local(d.fin).slice(11, 19),
          d.estado === 'sin_asignar' ? 'sin_confirmar' : d.estado,
          u.id,
          d.puesto,
          d.original[normalizar('MODALIDAD DE RESGUARDO')] || null,
          d.ingreso,
          d.salida,
          d.validada,
          d.tolerancia,
          d.requeridas,
          d.registradas ?? 0,
          d.limite || d.fin,
          d.registro,
          d.codigoTurno,
        ]
      );
      await c.query(
        'INSERT INTO importacion_filas(importacion_id,fila,turno_id) VALUES($1,$2,$3)',
        [id, d.fila, creado.rows[0].id]
      );
      for (const [col, papel] of [
        ['Placa de Resguardo', 'resguardo'],
        ['Placa Custodiada', 'custodiado'],
      ]) {
        for (const placa of (d.original[normalizar(col)] || '')
          .split(/\s*(?:\/\/|;|\n)\s*/)
          .filter(Boolean)) {
          const v = await buscarCrear(c, 'vehiculos', placa.toUpperCase());
          await c.query(
            'INSERT INTO servicio_vehiculos VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
            [servicio, v, papel]
          );
        }
      }
      for (const codigo of (d.original.contenedor || '')
        .split(/\s*(?:\/\/|;|\n)\s*/)
        .filter(Boolean)) {
        const v = await buscarCrear(c, 'contenedores', codigo.toUpperCase());
        await c.query(
          'INSERT INTO servicio_contenedores VALUES($1,$2) ON CONFLICT DO NOTHING',
          [servicio, v]
        );
      }
      turnos++;
    }
    await c.query('SELECT bi.refrescar()');
    const resultado = { turnos, serviciosNuevos, personalNuevo };
    await c.query(
      "UPDATE importaciones SET estado='importado',resultado=$2 WHERE id=$1",
      [id, resultado]
    );
    return resultado;
  });
}
module.exports = {
  plantilla,
  analizar,
  preparar,
  confirmar,
  normalizar,
  timestamp,
};

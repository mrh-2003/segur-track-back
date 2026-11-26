'use strict';
// Reinicio explícito y transaccional. Nunca se ejecuta al iniciar la aplicación.
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const pool = require('../src/config/db');
const migrar = require('../src/config/migrar');
const {
  evaluarFuentes,
  fechaLocal,
} = require('../src/services/evaluacion-operativa');

const DEFINICIONES = [
 ['C01','Puntualidad y asistencia',.2,20],
 ['C02','Cumplimiento de protocolos y consignas',.2,20],
 ['C03','Cumplimiento de actividades y rondas',.2,20],
 ['C04','Cumplimiento de reportes operativos',.2,20],
 ['C05','Gestión de incidencias',.2,20],
];
const MS_DIA = 86400000;
const azar = (a, b, c = 1) => {
  let x = ((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
};
const instante = (dia, hora, minutos = 0) =>
  new Date(+new Date(`${dia}T${hora}:00:00-05:00`) + minutos * 60000);

async function insertar(c, tabla, filas) {
  if (!filas.length) return;
  const columnas = Object.keys(filas[0]);
  for (let inicio = 0; inicio < filas.length; inicio += 150) {
    const lote = filas.slice(inicio, inicio + 150),
      valores = [];
    const lista = lote
      .map(
        (f) =>
          `(${columnas
            .map((k) => {
              let v = f[k];
              if (
                v !== null &&
                typeof v === 'object' &&
                !(v instanceof Date) &&
                !Buffer.isBuffer(v)
              )
                v = JSON.stringify(v);
              valores.push(v);
              return '$' + valores.length;
            })
            .join(',')})`
      )
      .join(',');
    await c.query(
      `INSERT INTO ${tabla}(${columnas.join(',')}) VALUES ${lista}`,
      valores
    );
  }
}

async function generar() {
  const ensayo = process.argv.includes('--dry-run');
  if (!ensayo && !process.argv.includes('--reset-demo'))
    throw new Error(
      'Use npm run db:demo -- --reset-demo para reemplazar explícitamente los datos por la demostración.'
    );
  await migrar();
  const c = await pool.connect();
  try {
    const posicion = process.argv.indexOf('--respaldo-verificado');
    if (!ensayo) {
      if (posicion < 0)
        throw new Error(
          'El reinicio requiere --respaldo-verificado con un respaldo previo'
        );
      const fs = require('node:fs'),
        zlib = require('node:zlib'),
        archivo = process.argv[posicion + 1],
        bytes = fs.readFileSync(archivo),
        manifest = JSON.parse(
          fs.readFileSync(archivo + '.manifest.json', 'utf8')
        );
      if (
        crypto.createHash('sha256').update(bytes).digest('hex') !==
        manifest.sha256
      )
        throw new Error('Respaldo no verificable');
      const respaldo = JSON.parse(zlib.gunzipSync(bytes)),
        base = (await c.query('SELECT current_database() AS nombre')).rows[0]
          .nombre;
      if (respaldo.base !== base)
        throw new Error('El respaldo no corresponde a la base configurada');
      for (const t of respaldo.tablas) {
        if (t.tablename === 'migraciones_aplicadas') continue;
        const n = Number(
          (
            await c.query(
              `SELECT COUNT(*) AS n FROM "${t.schemaname}"."${t.tablename}"`
            )
          ).rows[0].n
        );
        if (n !== t.filas.length)
          throw new Error(
            'Los datos cambiaron después del respaldo; cree un respaldo nuevo'
          );
      }
    }
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock(741095)');
    const { corte } = (await c.query('SELECT NOW() AS corte')).rows[0];
    const hoy = fechaLocal(corte);
    const tablas = (
      await c.query(
        "SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','bi') AND tablename<>'migraciones_aplicadas' ORDER BY schemaname,tablename"
      )
    ).rows;
    assert.ok(tablas.some((t) => t.tablename === 'usuarios'));
    const nombres = tablas
      .map((t) => `"${t.schemaname}"."${t.tablename}"`)
      .join(',');
    await c.query(`TRUNCATE TABLE ${nombres} RESTART IDENTITY`);
    await c.query('ALTER SEQUENCE seq_incidencias RESTART WITH 1');
    const clave = await bcrypt.hash('DemoSegur2026!', 10);
    const usuarios = [
      {
        id: 1,
        nombre: 'Adriana Mendoza',
        correo: 'admin@segurtrack.com',
        clave_hash: clave,
        rol: 'administrador',
        activo: true,
      },
      {
        id: 2,
        nombre: 'María Torres',
        correo: 'supervisor@segurtrack.com',
        clave_hash: clave,
        rol: 'supervisor',
        activo: true,
      },
      {
        id: 3,
        nombre: 'Renzo Salazar',
        correo: 'jefe@segurtrack.com',
        clave_hash: clave,
        rol: 'jefe_operaciones',
        activo: true,
      },
      {
        id: 4,
        nombre: 'Diego Rojas',
        correo: 'operador@segurtrack.com',
        clave_hash: clave,
        rol: 'operador',
        activo: true,
      },
      {
        id: 5,
        nombre: 'Lucía Paredes',
        correo: 'inactivo@segurtrack.com',
        clave_hash: clave,
        rol: 'operador',
        activo: false,
      },
    ];
    await insertar(c, 'usuarios', usuarios);
    await c.query(
      "SELECT set_config('app.usuario_id','1',true),set_config('app.motivo','Carga de datos de demostración',true)"
    );
    const sedes = [
      'Callao · Centro de operaciones',
      'Lima Norte · Base operativa',
      'Lima Sur · Base operativa',
      'Lima Este · Base operativa',
    ].map((nombre, i) => ({
      id: i + 1,
      nombre,
      direccion: [
        'Av. Néstor Gambetta 1250, Callao',
        'Av. Alfredo Mendiola 2800, Los Olivos',
        'Av. El Sol 125, Villa El Salvador',
        'Av. Nicolás Ayllón 3200, Ate',
      ][i],
    }));
    const clientes = [
      'Maersk Perú',
      'Operador Logístico Andino',
      'Grupo Comercial del Pacífico',
      'Red de Salud Integral',
      'Industrias del Sur',
      'Corporación Metropolitana',
    ].map((nombre, i) => ({
      id: i + 1,
      nombre,
      contacto: `operaciones${i + 1}@cliente.example`,
    }));
    await insertar(c, 'sedes', sedes);
    await insertar(c, 'clientes', clientes);
    const nombresPersonas = [
      'Diego',
      'Valeria',
      'Carlos',
      'Camila',
      'Jorge',
      'Daniela',
      'Luis',
      'Andrea',
      'Miguel',
      'Fernanda',
      'José',
      'Luciana',
      'Ricardo',
      'Gabriela',
      'Alonso',
      'Paola',
    ];
    const apellidos = [
      'Rojas Medina',
      'Vargas Flores',
      'Quispe Ramos',
      'Castro León',
      'Paredes Silva',
      'Morales Díaz',
      'Herrera Cruz',
      'Mendoza Reyes',
      'Sánchez Vega',
      'Torres López',
      'Salazar Ríos',
      'Gómez Aguilar',
    ];
    const personal = [
      {
        id: 1,
        nombres: 'Renzo',
        apellidos: 'Salazar Ponce',
        documento: '80000001',
        cargo: 'jefe_operaciones',
        estado: 'activo',
        correo: 'jefe@segurtrack.com',
        sede_id: 1,
        usuario_id: 3,
      },
    ];
    for (let i = 0; i < 4; i++)
      personal.push({
        id: i + 2,
        nombres: ['María', 'Álvaro', 'Sofía', 'Martín'][i],
        apellidos: [
          'Torres Medina',
          'Quispe Flores',
          'Reyes Castro',
          'Vega León',
        ][i],
        documento: String(80000002 + i),
        cargo: 'supervisor',
        estado: 'activo',
        correo:
          i === 0
            ? 'supervisor@segurtrack.com'
            : `supervisor${i + 1}@segurtrack.example`,
        sede_id: i + 1,
        usuario_id: i === 0 ? 2 : null,
      });
    for (let i = 0; i < 64; i++)
      personal.push({
        id: i + 6,
        nombres: nombresPersonas[i % 16],
        apellidos: apellidos[(i + Math.floor(i / 16)) % 12],
        documento: String(80000006 + i),
        cargo: 'agente',
        estado: i >= 60 ? 'inactivo' : 'activo',
        correo:
          i === 0
            ? 'operador@segurtrack.com'
            : i === 60
              ? 'inactivo@segurtrack.com'
              : `agente${i + 1}@segurtrack.example`,
        sede_id: (Math.floor(i / 4) % 4) + 1,
        usuario_id: i === 0 ? 4 : i === 60 ? 5 : null,
      });
    personal.push({
      id: 70,
      nombres: 'Adriana',
      apellidos: 'Mendoza Ruiz',
      documento: '80000070',
      cargo: 'administrador',
      estado: 'activo',
      correo: 'admin@segurtrack.com',
      sede_id: 1,
      usuario_id: 1,
    });
    await insertar(c, 'personal', personal);
    const titulos = [
      'Terminal portuario · Callao',
      'Custodia logística · Gambetta',
      'Almacén de carga · Ventanilla',
      'Centro comercial · San Miguel',
      'Clínica integral · San Isidro',
      'Parque industrial · Ate',
      'Centro de distribución · Lurín',
      'Campus corporativo · Surco',
      'Planta industrial · Villa El Salvador',
      'Centro logístico · Huachipa',
      'Custodia de contenedores · APM',
      'Almacén de tránsito · Santa Anita',
    ];
    const servicios = titulos.map((nombre, i) => ({
      id: i + 1,
      nombre,
      codigo_externo: `DEMO-SRV-${String(i + 1).padStart(3, '0')}`,
      cliente_id: Math.floor(i / 2) + 1,
      sede_id: (i % 4) + 1,
      supervisor_id: (i % 4) + 2,
      hora_inicio: '06:00',
      hora_fin: '02:00',
      estado:
        i === 3 || i === 7
          ? 'finalizado'
          : i === 2 || i === 5
            ? 'programado'
            : 'en_curso',
      fecha_inicio: fechaLocal(
        new Date(+new Date(hoy + 'T12:00:00-05:00') - 31 * MS_DIA)
      ),
      fecha_fin:
        i === 3 || i === 7
          ? fechaLocal(new Date(+new Date(hoy + 'T12:00:00-05:00') - MS_DIA))
          : null,
    }));
    await insertar(c, 'servicios', servicios);
    await insertar(c, 'configuracion_operativa', [
      {
        id: 1,
        sla_alta: 60,
        sla_media: 240,
        sla_baja: 1440,
        datos_demo: true,
        demo_generada_en: corte,
      },
    ]);
    await insertar(
      c,
      'modelo_operativo',
      DEFINICIONES.map(([codigo, nombre, peso, umbral]) => ({
        codigo,
        nombre,
        peso,
        umbral,
      }))
    );
    await insertar(
      c,
      'criterios_mcda',
      DEFINICIONES.map(([codigo, nombre, peso], i) => ({
        id: i + 1,
        codigo,
        nombre,
        descripcion: 'Criterio operativo de la demostración',
        peso,
        activo: true,
      }))
    );
    const protocolos = [
      'Control de ingreso y relevo',
      'Ronda y verificación perimetral',
      'Custodia de carga y precintos',
      'Control de accesos y novedades',
      'Reporte de cierre del turno',
    ].map((nombre, i) => ({
      id: i + 1,
      codigo: `PRO-${i + 1}`,
      nombre,
      descripcion: 'Protocolo de demostración para el seguimiento operativo.',
      actividades:
        'Verificar puesto, registrar evidencia y comunicar novedades.',
      activo: true,
    }));
    await insertar(c, 'protocolos', protocolos);
    const enlaces = [],
      requerimientos = [];
    for (const s of servicios) {
      for (let j = 0; j < 3; j++)
        enlaces.push({ servicio_id: s.id, protocolo_id: ((s.id + j) % 5) + 1 });
      for (let j = 0; j < 3; j++)
        requerimientos.push({
          servicio_id: s.id,
          titulo: [
            'Dotación por franja',
            'Evidencia del puesto',
            'Comunicación de novedades',
          ][j],
          descripcion: [
            'Dos agentes por turno; registrar vacantes y relevos.',
            'Dos registros por turno antes del cierre.',
            'Registrar incidencias y asignar responsable de atención.',
          ][j],
          prioridad: j === 0 ? 'alta' : 'media',
        });
    }
    await insertar(c, 'servicio_protocolos', enlaces);
    await insertar(c, 'servicio_requerimientos', requerimientos);
    const tipos = [
      'Ausencia de personal',
      'Llegada tardía',
      'Falla de equipo',
      'Acceso no autorizado',
      'Novedad de custodia',
      'Incumplimiento de protocolo',
      'Relevo no presentado',
      'Alerta perimetral',
    ];
    await insertar(
      c,
      'tipos_incidencia',
      tipos.map((nombre, i) => ({ id: i + 1, nombre }))
    );
    const turnos = [],
      incidencias = [],
      evidencias = [],
      relaciones = new Map();
    const probabilidades = [
      0.008, 0.014, 0.022, 0.035, 0.05, 0.065, 0.08, 0.1, 0.12, 0.14, 0.18,
      0.23,
    ];
    let turnoId = 0,
      incId = 0,
      eviId = 0;
    for (let desfase = -31; desfase <= 2; desfase++) {
      const dia = fechaLocal(
        new Date(+new Date(hoy + 'T12:00:00-05:00') + desfase * MS_DIA)
      );
      for (const s of servicios) {
        if (s.estado === 'finalizado' && desfase >= 0) continue;
        const base =
          probabilidades[s.id - 1] *
          (desfase < -18 ? 1.2 : desfase > -8 ? 0.78 : 1);
        for (let franja = 0; franja < 2; franja++) {
          const inicio = instante(dia, franja ? '18' : '06'),
            fin = new Date(+inicio + 8 * 3600000),
            pasado = fin <= corte,
            iniciado = inicio <= corte;
          for (let plaza = 0; plaza < 2; plaza++) {
            turnoId++;
            const semilla = (desfase + 40) * 11 + franja * 3 + plaza;
            const vacante = iniciado && azar(s.id, semilla, 1) < base * 0.5;
            const ausencia =
              iniciado && !vacante && azar(s.id, semilla, 2) < base * 0.22;
            const tardanza =
              !vacante && !ausencia && azar(s.id, semilla, 3) < base * 0.9;
            const incompleto =
              pasado &&
              !vacante &&
              !ausencia &&
              azar(s.id, semilla, 4) < base * 0.65;
            const personalId = vacante
              ? null
              : 6 + (s.id - 1) * 4 + franja * 2 + plaza;
            const ingreso =
              iniciado && !vacante && !ausencia
                ? new Date(
                    +inicio +
                      (tardanza
                        ? 18 + Math.floor(azar(s.id, semilla, 5) * 35)
                        : -5 + Math.floor(azar(s.id, semilla, 6) * 12)) *
                        60000
                  )
                : null;
            const ingresoReal = ingreso && ingreso <= corte ? ingreso : null;
            const salida =
              pasado && ingresoReal
                ? new Date(+fin + (incompleto ? -25 : 2) * 60000)
                : null;
            const faltaEvidencia =
              vacante || ausencia || azar(s.id, semilla, 7) < base * 1.2;
            const cantidad = ingresoReal
              ? faltaEvidencia
                ? azar(s.id, semilla, 8) < 0.5
                  ? 0
                  : 1
                : 2
              : 0;
            const registro =
              pasado && cantidad
                ? new Date(
                    +fin +
                      (azar(s.id, semilla, 9) < base * 0.8 ? 35 : -8) * 60000
                  )
                : cantidad && +inicio + 90 * 60000 < +corte
                  ? new Date(+inicio + 90 * 60000)
                  : null;
            const registroReal =
              registro && registro <= corte ? registro : null;
            const registradas = registroReal ? cantidad : 0;
            const estado = pasado
              ? salida && !incompleto
                ? 'cumplido'
                : 'pendiente'
              : iniciado
                ? 'confirmado'
                : azar(s.id, semilla, 10) < 0.4
                  ? 'sin_confirmar'
                  : 'programado';
            const t = {
              id: turnoId,
              personal_id: personalId,
              servicio_id: s.id,
              sede_id: s.sede_id,
              fecha: dia,
              hora_inicio: franja ? '18:00' : '06:00',
              hora_fin: franja ? '02:00' : '14:00',
              estado,
              relevo_pendiente: vacante,
              motivo_rechazo: vacante
                ? 'Vacante de demostración pendiente de cobertura'
                : null,
              creado_por: 2,
              puesto: ['Acceso principal', 'Control perimetral'][plaza],
              funcion:
                s.id <= 3 || s.id === 11
                  ? plaza
                    ? 'cabinero'
                    : 'conductor'
                  : 'agente',
              ingreso_real: ingresoReal,
              salida_real: salida,
              asistencia_validada: iniciado,
              tolerancia_min: 10,
              evidencias_requeridas: 2,
              evidencias_registradas: registradas,
              evidencia_limite: fin,
              evidencia_registro: registroReal,
              evidencias: Array.from(
                { length: registradas },
                (_, j) =>
                  `/demo/evidencia-operativa.svg?turno=${turnoId}&registro=${j + 1}`
              ),
              creado_en: new Date(+inicio - 2 * MS_DIA),
              actualizado_en:
                salida || ingresoReal || new Date(+inicio - 2 * MS_DIA),
            };
            turnos.push(t);
            if (personalId)
              relaciones.set(`${s.id}-${personalId}`, {
                servicio_id: s.id,
                personal_id: personalId,
              });
            for (let j = 0; j < registradas; j++) {
              eviId++;
              const revisada =
                +registroReal + 45 * 60000 < +corte &&
                azar(s.id, semilla, j + 31) > 0.12;
              evidencias.push({
                id: eviId,
                servicio_id: s.id,
                turno_id: t.id,
                protocolo_id: ((s.id + j) % 5) + 1,
                personal_id: personalId,
                titulo:
                  ['Verificación del puesto', 'Registro de ronda'][j] +
                  ' · demostración',
                descripcion:
                  'Registro sintético de prueba. No corresponde a una operación real.',
                archivo_url: t.evidencias[j],
                estado_revision: revisada
                  ? azar(s.id, semilla, j + 30) < base
                    ? 'observada'
                    : 'aprobada'
                  : 'pendiente',
                observacion:
                  revisada && azar(s.id, semilla, j + 30) < base
                    ? 'Repetir el encuadre de la evidencia de prueba.'
                    : null,
                revisado_por: revisada ? 2 : null,
                fecha_revision: revisada
                  ? new Date(+registroReal + 45 * 60000)
                  : null,
                creado_en: registroReal,
                actualizado_en: registroReal,
              });
            }
          }
          const registro = new Date(+inicio + 40 * 60000);
          if (registro < corte) {
            incId++;
            const prioridad = ['alta', 'media', 'baja'][
                (s.id + desfase + franja + 90) % 3
              ],
              sla = { alta: 60, media: 240, baja: 1440 }[prioridad];
            const fuera = azar(s.id, desfase + 40, franja + 60) < base * 2.4;
            const pendiente =
              azar(s.id, desfase + 40, franja + 65) < 0.08 + base * 0.65;
            const atencion = pendiente
              ? null
              : new Date(
                  +registro +
                    sla *
                      (fuera
                        ? 1.35
                        : 0.25 + azar(s.id, desfase + 40, franja + 70) * 0.5) *
                      60000
                );
            const realAtencion = atencion && atencion < corte ? atencion : null;
            const cierre =
              realAtencion &&
              +realAtencion + 35 * 60000 < +corte &&
              azar(s.id, desfase + 40, franja + 71) > 0.19
                ? new Date(+realAtencion + 35 * 60000)
                : null;
            incidencias.push({
              id: incId,
              codigo: `INC-${String(incId).padStart(4, '0')}`,
              tipo_incidencia_id: ((s.id + desfase + franja + 80) % 8) + 1,
              servicio_id: s.id,
              turno_id: turnoId - 1,
              personal_id: 6 + (s.id - 1) * 4 + franja * 2,
              descripcion: `${tipos[(s.id + desfase + franja + 80) % 8]} en ${s.nombre}. Caso de demostración para seguimiento operativo.`,
              prioridad,
              estado: cierre
                ? 'cerrada'
                : realAtencion
                  ? 'en_atencion'
                  : 'abierta',
              fecha_registro: registro,
              fecha_atencion: realAtencion,
              fecha_cierre: cierre,
              observacion: cierre
                ? 'Caso de prueba atendido y cerrado con verificación del supervisor.'
                : realAtencion
                  ? 'El supervisor está coordinando la atención del caso de prueba.'
                  : 'Pendiente de intervención del responsable asignado.',
              registrado_por: 4,
              responsable_id: 6 + (s.id - 1) * 4 + franja * 2,
              sla_min: sla,
              creado_en: registro,
              actualizado_en: cierre || realAtencion || registro,
            });
          }
        }
      }
    }
    await insertar(c, 'servicio_personal', [...relaciones.values()]);
    await insertar(c, 'turnos', turnos);
    await insertar(c, 'incidencias', incidencias);
    await insertar(c, 'evidencias_servicio', evidencias);
    await c.query(
      'UPDATE turnos_historial h SET creado_en=t.creado_en FROM turnos t WHERE h.turno_id=t.id'
    );
    await c.query(
      'UPDATE incidencias_historial h SET creado_en=i.fecha_registro FROM incidencias i WHERE h.incidencia_id=i.id'
    );
    for (const s of servicios.filter((s) => s.estado !== 'finalizado')) {
      const t = turnos.find(
        (t) => t.servicio_id === s.id && t.fecha > hoy && t.personal_id
      );
      if (t) {
        const reserva = 53 + s.id;
        await c.query(
          "SELECT set_config('app.motivo','Reasignación de demostración por descanso del agente',true)"
        );
        await c.query(
          "UPDATE turnos SET personal_id=$2,estado='sin_confirmar',actualizado_en=NOW() WHERE id=$1",
          [t.id, reserva]
        );
        await c.query(
          'INSERT INTO servicio_personal(servicio_id,personal_id) VALUES($1,$2)',
          [s.id, reserva]
        );
      }
    }
    await insertar(
      c,
      'personal_ausencias',
      Array.from({ length: 8 }, (_, i) => ({
        personal_id: i < 4 ? 54 + i : 6 + i * 4,
        inicio: new Date(
          +new Date(hoy + 'T00:00:00-05:00') + (i < 4 ? 0 : MS_DIA)
        ),
        fin: new Date(
          +new Date(hoy + 'T00:00:00-05:00') + (i < 4 ? MS_DIA : 3 * MS_DIA)
        ),
        motivo: [
          'Descanso semanal',
          'Vacaciones programadas',
          'Licencia personal',
          'Capacitación operativa',
        ][i % 4],
        creado_por: 2,
      }))
    );
    const ubicaciones = [
      'Terminal APM · Callao',
      'Almacén TecnoCarga · Lurín',
      'Centro de carga · Gambetta',
      'Depósito aduanero · Ventanilla',
      'Base operativa · Ate',
      'Terminal de contenedores · Callao',
      'Centro logístico · Huachipa',
      'Almacén de tránsito · Santa Anita',
    ];
    await insertar(
      c,
      'ubicaciones_operativas',
      ubicaciones.map((nombre, i) => ({ id: i + 1, nombre }))
    );
    await insertar(
      c,
      'transportistas',
      [
        'Transporte Andino',
        'Logística del Pacífico',
        'Carga Metropolitana',
        'Transportes Costa Sur',
      ].map((nombre, i) => ({ id: i + 1, nombre }))
    );
    await insertar(
      c,
      'vehiculos',
      Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        placa: `DEM-${String(100 + i)}`,
      }))
    );
    await insertar(
      c,
      'contenedores',
      Array.from({ length: 24 }, (_, i) => ({
        id: i + 1,
        codigo: `DEMO${String(1000000 + i)}`,
      }))
    );
    await insertar(
      c,
      'servicio_custodias',
      servicios
        .filter((s) => [1, 2, 3, 9, 10, 11].includes(s.id))
        .map((s, i) => ({
          servicio_id: s.id,
          cliente_almacen: [
            'TecnoCarga',
            'Almacén Costa Azul',
            'Depósito Pacífico',
          ][i % 3],
          solicitante: ['Daniel Poma', 'Carolina Reyes', 'Alberto Medina'][
            i % 3
          ],
          referencias: `ORD-DEMO-${s.id}`,
          transportista_id: (i % 4) + 1,
          origen_id: (i % 8) + 1,
          destino_id: ((i + 3) % 8) + 1,
          hitos: {
            tipo: 'demostración',
            instalacion: '05:50',
            inicio: '06:00',
            llegada: '13:30',
            termino: '14:00',
          },
          observacion: 'Custodia de demostración. Datos sintéticos.',
        }))
    );
    await insertar(
      c,
      'servicio_vehiculos',
      servicios.flatMap((s, i) => [
        { servicio_id: s.id, vehiculo_id: (i % 20) + 1, papel: 'resguardo' },
        {
          servicio_id: s.id,
          vehiculo_id: ((i + 8) % 20) + 1,
          papel: 'custodiado',
        },
      ])
    );
    await insertar(
      c,
      'servicio_contenedores',
      servicios.flatMap((s, i) => [
        { servicio_id: s.id, contenedor_id: i * 2 + 1 },
        { servicio_id: s.id, contenedor_id: i * 2 + 2 },
      ])
    );
    await insertar(
      c,
      'reportes_generados',
      Array.from({ length: 12 }, (_, i) => ({
        tipo: ['servicios', 'turnos', 'incidencias', 'bi', 'multicriterio'][
          i % 5
        ],
        categoria:
          i % 5 === 2
            ? 'incidencias'
            : i % 5 === 4
              ? 'multicriterio'
              : 'operativos',
        formato: i % 2 ? 'pdf' : 'xlsx',
        estado: i === 11 ? 'error' : i === 10 ? 'procesando' : 'completado',
        generado_por: 1,
        creado_en: new Date(+corte - i * 3600000),
      }))
    );
    await insertar(
      c,
      'actividad_reciente',
      Array.from({ length: 40 }, (_, i) => ({
        tipo: [
          'turno_confirmado',
          'turno_reasignado',
          'incidencia_registrada',
          'evidencia_registrada',
          'servicio_actualizado',
        ][i % 5],
        descripcion: [
          'Turno diurno confirmado en Terminal portuario.',
          'Relevo coordinado con el equipo de reserva.',
          'Incidencia prioritaria asignada a supervisión.',
          'Evidencia del puesto verificada por supervisión.',
          'Servicio actualizado en el centro de operaciones.',
        ][i % 5],
        usuario_id: (i % 4) + 1,
        creado_en: new Date(+corte - i * 31 * 60000),
      }))
    );
    // Lote de demostración con archivo Excel y referencias reales a sus filas.
    const muestra = turnos
      .filter((t) => t.personal_id && t.fecha < hoy)
      .slice(0, 24);
    const { archivo, filas: filasArchivo } =
      await require('./demo-archivo.cjs')(
        muestra,
        servicios,
        clientes,
        personal,
        sedes
      );
    const lote = (
      await c.query(
        "INSERT INTO importaciones(huella,nombre,usuario_id,datos,resultado,estado,archivo) VALUES($1,'Tareaje_demostracion.xlsx',1,$2,$3,'importado',$4) RETURNING id",
        [
          crypto.createHash('sha256').update(archivo).digest('hex'),
          {
            filas: filasArchivo,
            errores: [],
            advertencias: [],
            hoja: 'Tareaje',
          },
          {
            turnos: muestra.length,
            serviciosNuevos: new Set(muestra.map((t) => t.servicio_id)).size,
            personalNuevo: new Set(muestra.map((t) => t.personal_id)).size,
          },
          archivo,
        ]
      )
    ).rows[0];
    for (let i = 0; i < muestra.length; i++) {
      await c.query(
        'INSERT INTO importacion_filas(importacion_id,fila,turno_id) VALUES($1,$2,$3)',
        [lote.id, i + 2, muestra[i].id]
      );
      await c.query('UPDATE turnos SET clave_importacion=$2 WHERE id=$1', [
        muestra[i].id,
        `DEMO-TUR-${muestra[i].id}`,
      ]);
    }
    await c.query(
      "UPDATE turnos t SET personal_id=NULL,estado='sin_confirmar',relevo_pendiente=TRUE WHERE t.fecha>$1 AND EXISTS(SELECT 1 FROM personal_ausencias a JOIN vw_operacion_turnos v ON v.id=t.id WHERE a.personal_id=t.personal_id AND a.inicio<v.fin_programado AND a.fin>v.inicio_programado AND NOT a.eliminado)",
      [hoy]
    );
    await c.query('SELECT bi.refrescar()');
    // El generador usa IDs explícitos y ajusta sus secuencias al final; el ensayo no consume IDs.
    await require('./datos-kpi-demo.cjs')(c,{idsExplicitos:true});
    const cargar = async () => ({
      servicios: (
        await c.query(
          'SELECT s.*,c.nombre AS cliente FROM servicios s JOIN clientes c ON c.id=s.cliente_id'
        )
      ).rows,
      turnos: (
        await c.query(
          "SELECT t.*,b.plan_kpi_validado,TO_CHAR(t.fecha,'YYYY-MM-DD') AS dia FROM vw_operacion_turnos t JOIN turnos b ON b.id=t.id"
        )
      ).rows,
      incidencias: (await c.query('SELECT * FROM incidencias')).rows,
      criterios: (
        await c.query('SELECT * FROM modelo_operativo ORDER BY codigo')
      ).rows,
      obligaciones:(await c.query('SELECT * FROM obligaciones_operativas WHERE NOT eliminado')).rows,
      rondas:(await c.query('SELECT * FROM rondas WHERE NOT eliminado')).rows,
      verificacionesConsignas:(await c.query('SELECT * FROM verificaciones_consignas')).rows,
      evidenciasServicio:(await c.query('SELECT * FROM evidencias_servicio WHERE NOT eliminado')).rows,
      corte,
    });
    const fuentes = await cargar();
    const comprobaciones = [];
    for (const periodo of ['3', '7', '30', 'todos'])
      for (const turno of ['ambos', 'diurno', 'nocturno']) {
        const r = evaluarFuentes(fuentes, { periodo, turno });
        assert.equal(r.tabla.length, 12);
        assert.ok(
          r.tabla.every(
            (s) => s.completo && s.criterios.every((k) => k.faltantes === 0)
          ),
          `Evaluación incompleta: ${periodo}/${turno}`
        );
        comprobaciones.push({ periodo, turno, evaluados: r.resumen.evaluados });
      }
    const resultado = evaluarFuentes(fuentes, { periodo: '30' });
    assert.equal(
      new Set(resultado.tabla.map((s) => s.nivel)).size,
      3,
      'La demostración debe incluir riesgo alto, medio y bajo'
    );
    for (const s of resultado.tabla) {
      await c.query(
        'INSERT INTO evaluaciones_operativas(servicio_id,usuario_id,version,filtros,resultado) VALUES($1,1,$2,$3,$4)',
        [s.id, resultado.version, resultado.filtros, s]
      );
      const ev = (
        await c.query(
          'INSERT INTO evaluaciones_multicriterio(servicio_id,puntaje_global,nivel) VALUES($1,$2,$3) RETURNING id',
          [s.id, s.puntaje, s.nivel]
        )
      ).rows[0];
      await insertar(
        c,
        'evaluacion_criterios',
        s.criterios.map((k, i) => ({
          evaluacion_id: ev.id,
          criterio_id: i + 1,
          puntaje: k.riesgo,
          influye: k.riesgo >= 60,
        }))
      );
    }
    // Sincronizar todas las secuencias tras la carga con IDs estables.
    const conId = new Set(
      (
        await c.query(
          "SELECT table_schema||'.'||table_name AS nombre FROM information_schema.columns WHERE table_schema IN ('public','bi') AND column_name='id'"
        )
      ).rows.map((r) => r.nombre)
    );
    for (const t of ensayo ? [] : tablas) {
      if (!conId.has(`${t.schemaname}.${t.tablename}`)) continue;
      const sec = (
        await c.query("SELECT pg_get_serial_sequence($1,'id') AS nombre", [
          `${t.schemaname}.${t.tablename}`,
        ])
      ).rows[0]?.nombre;
      if (sec)
        await c.query(
          `SELECT setval($1,COALESCE((SELECT MAX(id) FROM "${t.schemaname}"."${t.tablename}"),1),EXISTS(SELECT 1 FROM "${t.schemaname}"."${t.tablename}"))`,
          [sec]
        );
    }
    if (!ensayo)
      await c.query("SELECT setval('seq_incidencias',$1,true)", [incId]);
    const conteos = {};
    for (const t of tablas)
      conteos[`${t.schemaname}.${t.tablename}`] = Number(
        (
          await c.query(
            `SELECT COUNT(*) AS n FROM "${t.schemaname}"."${t.tablename}"`
          )
        ).rows[0].n
      );
    assert.ok(
      Object.entries(conteos).every(([, n]) => n > 0),
      'Todas las tablas de negocio y BI deben tener datos'
    );
    await c.query(ensayo ? 'ROLLBACK' : 'COMMIT');
    console.log(
      JSON.stringify(
        {
          modo: ensayo ? 'ensayo_revertido' : 'demo_aplicada',
          base: (await c.query('SELECT current_database() AS nombre')).rows[0]
            .nombre,
          fechaBase: hoy,
          conteos,
          comprobaciones,
          niveles: resultado.tabla.map((s) => ({
            servicio: s.servicio,
            puntaje: Number(s.puntaje.toFixed(1)),
            nivel: s.nivel,
          })),
          acceso: { correo: 'admin@segurtrack.com', clave: 'DemoSegur2026!' },
        },
        null,
        2
      )
    );
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
generar()
  .catch((e) => {
    console.error(e.stack);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

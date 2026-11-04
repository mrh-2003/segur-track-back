'use strict';
const ExcelJS = require('exceljs');
const {
  plantilla,
  normalizar,
} = require('../src/services/importaciones.service');
const { fechaLocal } = require('../src/services/evaluacion-operativa');
const local = (v) =>
  v
    ? new Date(+new Date(v) - 5 * 3600000)
        .toISOString()
        .slice(0, 16)
        .replace('T', ' ')
    : '';
module.exports = async (muestra, servicios, clientes, personal, sedes) => {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await plantilla());
  const hoja = libro.getWorksheet('Tareaje'),
    headers = hoja.getRow(1).values.slice(1),
    filas = [];
  for (let i = 0; i < muestra.length; i++) {
    const t = muestra[i],
      s = servicios.find((s) => s.id === t.servicio_id),
      p = personal.find((p) => p.id === t.personal_id),
      sup = personal.find((p) => p.id === s.supervisor_id),
      cliente = clientes.find((c) => c.id === s.cliente_id),
      sede = sedes.find((s) => s.id === t.sede_id);
    const dia =
        typeof t.fecha === 'string'
          ? t.fecha.slice(0, 10)
          : fechaLocal(t.fecha),
      hora = t.hora_inicio.slice(0, 5),
      final = t.hora_fin.slice(0, 5),
      inicio = new Date(`${dia}T${hora}:00-05:00`),
      fin = new Date(`${dia}T${final}:00-05:00`);
    if (fin <= inicio) fin.setUTCDate(fin.getUTCDate() + 1);
    const valores = {
      Empresa: cliente.nombre,
      'Cliente/Almacen': 'Almacén de demostración',
      RESGUARDO: p.nombres + ' ' + p.apellidos,
      'MODALIDAD DE RESGUARDO': t.funcion || 'agente',
      Fecha: dia,
      'PUNTO INICIO': t.puesto,
      'PUNTO FINAL': t.puesto,
      Observacion: 'Datos sintéticos de demostración',
      'Codigo servicio': s.codigo_externo,
      'Codigo turno': `DEMO-TUR-${t.id}`,
      DNI: p.documento,
      Nombres: p.nombres,
      Apellidos: p.apellidos,
      Sede: sede.nombre,
      'Supervisor DNI': sup.documento,
      Puesto: t.puesto,
      'Inicio programado': local(inicio),
      'Fin programado': local(fin),
      'Ingreso real': local(t.ingreso_real),
      'Salida real': local(t.salida_real),
      'Asistencia validada': 'SI',
      'Estado turno': t.estado,
      'Evidencias requeridas': t.evidencias_requeridas,
      'Evidencias registradas': t.evidencias_registradas,
      'Limite evidencias': local(t.evidencia_limite),
      'Fecha registro evidencias': local(t.evidencia_registro),
      'Tolerancia minutos': 10,
    };
    hoja.addRow(headers.map((h) => valores[h] ?? null));
    filas.push({
      fila: i + 2,
      codigoTurno: valores['Codigo turno'],
      codigoServicio: s.codigo_externo,
      empresa: cliente.nombre,
      dni: p.documento,
      nombres: p.nombres,
      apellidos: p.apellidos,
      sede: sede.nombre,
      puesto: t.puesto,
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      estado: t.estado,
      original: Object.fromEntries(
        Object.entries(valores).map(([k, v]) => [normalizar(k), String(v)])
      ),
    });
  }
  return { archivo: Buffer.from(await libro.xlsx.writeBuffer()), filas };
};

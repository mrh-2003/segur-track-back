'use strict';

const zlib = require('zlib');
const pool = require('../config/db');

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function calcularCrc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function crearZip(archivos) {
  const entradas = [];
  const partes = [];
  let offset = 0;

  for (const archivo of archivos) {
    const data = Buffer.isBuffer(archivo.contenido) ? archivo.contenido : Buffer.from(archivo.contenido, 'utf8');
    const nombreBuf = Buffer.from(archivo.nombre, 'utf8');
    const comprimido = zlib.deflateRawSync(data);
    const crc = calcularCrc32(data);

    const cabeceraLocal = Buffer.alloc(30 + nombreBuf.length);
    cabeceraLocal.writeUInt32LE(0x04034b50, 0);
    cabeceraLocal.writeUInt16LE(20, 4);
    cabeceraLocal.writeUInt16LE(0, 6);
    cabeceraLocal.writeUInt16LE(8, 8);
    cabeceraLocal.writeUInt16LE(0, 10);
    cabeceraLocal.writeUInt16LE(0, 12);
    cabeceraLocal.writeUInt32LE(crc, 14);
    cabeceraLocal.writeUInt32LE(comprimido.length, 18);
    cabeceraLocal.writeUInt32LE(data.length, 22);
    cabeceraLocal.writeUInt16LE(nombreBuf.length, 26);
    cabeceraLocal.writeUInt16LE(0, 28);
    nombreBuf.copy(cabeceraLocal, 30);

    entradas.push({ nombreBuf, crc, cLen: comprimido.length, uLen: data.length, offset });
    partes.push(cabeceraLocal, comprimido);
    offset += cabeceraLocal.length + comprimido.length;
  }

  const cdInicio = offset;
  for (const e of entradas) {
    const cd = Buffer.alloc(46 + e.nombreBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(e.crc, 16);
    cd.writeUInt32LE(e.cLen, 20);
    cd.writeUInt32LE(e.uLen, 24);
    cd.writeUInt16LE(e.nombreBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(e.offset, 42);
    e.nombreBuf.copy(cd, 46);
    partes.push(cd);
    offset += cd.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entradas.length, 8);
  eocd.writeUInt16LE(entradas.length, 10);
  eocd.writeUInt32LE(offset - cdInicio, 12);
  eocd.writeUInt32LE(cdInicio, 16);
  eocd.writeUInt16LE(0, 20);
  partes.push(eocd);

  return Buffer.concat(partes);
}

function escaparXml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const xmlContentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

const xmlRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const xmlWorkbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

const xmlWorkbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Reporte" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

function obtenerLetraColumna(idx) {
  let letra = '';
  let temp = idx;
  while (temp >= 0) {
    letra = String.fromCharCode((temp % 26) + 65) + letra;
    temp = Math.floor(temp / 26) - 1;
  }
  return letra;
}

function generarXlsx(titulo, columnas, filas) {
  let xmlSheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>${escaparXml(titulo)}</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><is><t>Generado por Segur Track - ${new Date().toLocaleString('es-PE')}</t></is></c>
    </row>
    <row r="4">`;

  columnas.forEach((col, idx) => {
    const colLetra = obtenerLetraColumna(idx);
    xmlSheet += `<c r="${colLetra}4" t="inlineStr"><is><t>${escaparXml(col)}</t></is></c>`;
  });
  xmlSheet += `</row>`;

  filas.forEach((fila, fIdx) => {
    const numFila = 5 + fIdx;
    xmlSheet += `<row r="${numFila}">`;
    fila.forEach((val, cIdx) => {
      const colLetra = obtenerLetraColumna(cIdx);
      xmlSheet += `<c r="${colLetra}${numFila}" t="inlineStr"><is><t>${escaparXml(val)}</t></is></c>`;
    });
    xmlSheet += `</row>`;
  });

  xmlSheet += `</sheetData></worksheet>`;

  return crearZip([
    { nombre: '[Content_Types].xml', contenido: xmlContentTypes },
    { nombre: '_rels/.rels', contenido: xmlRels },
    { nombre: 'xl/_rels/workbook.xml.rels', contenido: xmlWorkbookRels },
    { nombre: 'xl/workbook.xml', contenido: xmlWorkbook },
    { nombre: 'xl/worksheets/sheet1.xml', contenido: xmlSheet },
  ]);
}

function escaparPdfTexto(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function calcularAnchosColumnas(columnas, filas, anchoTotal) {
  const pesos = columnas.map((col, idx) => {
    let max = col.length;
    for (const f of filas.slice(0, 50)) {
      const s = String(f[idx] ?? '');
      if (s.length > max) max = Math.min(s.length, 35);
    }
    return Math.max(max, 5);
  });
  const suma = pesos.reduce((a, b) => a + b, 0);
  const anchos = pesos.map((p) => Math.max(40, Math.floor((p / suma) * anchoTotal)));
  const diff = anchoTotal - anchos.reduce((a, b) => a + b, 0);
  anchos[anchos.length - 1] += diff;
  return anchos;
}

function recortarTexto(txt, maxLen) {
  const s = String(txt !== null && txt !== undefined ? txt : '—').trim();
  if (s.length <= maxLen) return s;
  if (maxLen <= 4) return s.slice(0, maxLen);
  return s.slice(0, maxLen - 2) + '..';
}

function generarPdf(titulo, columnas, filas) {
  const lineas = [];
  const ahora = new Date();
  const dia = String(ahora.getDate()).padStart(2, '0');
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const anio = ahora.getFullYear();
  const horas = String(ahora.getHours()).padStart(2, '0');
  const mins = String(ahora.getMinutes()).padStart(2, '0');
  const fechaGenerado = `${dia}/${mes}/${anio} ${horas}:${mins}`;

  lineas.push(`BT /F2 15 Tf 36 575 Td (${escaparPdfTexto('SEGUR TRACK — SISTEMA DE SEGURIDAD')}) Tj ET`);
  lineas.push(`BT /F1 11 Tf 36 558 Td (${escaparPdfTexto(titulo)}) Tj ET`);
  lineas.push(`BT /F1 8 Tf 36 544 Td (${escaparPdfTexto('Generado: ' + fechaGenerado)}) Tj ET`);

  const anchoTotal = 720;
  const anchos = calcularAnchosColumnas(columnas, filas, anchoTotal);

  let y = 515;
  let x = 36;

  for (let i = 0; i < columnas.length; i++) {
    const maxHeader = Math.max(3, Math.floor((anchos[i] - 6) / 5.2));
    const headerTxt = recortarTexto(columnas[i], maxHeader);
    lineas.push(`BT /F2 8.5 Tf ${x} ${y} Td (${escaparPdfTexto(headerTxt)}) Tj ET`);
    x += anchos[i];
  }

  y -= 6;
  lineas.push(`36 ${y} m 756 ${y} l S`);
  y -= 14;

  for (const fila of filas) {
    if (y < 35) break;
    let xFila = 36;
    for (let i = 0; i < fila.length; i++) {
      const maxCelda = Math.max(3, Math.floor((anchos[i] - 6) / 4.7));
      const celdaTxt = recortarTexto(fila[i], maxCelda);
      lineas.push(`BT /F1 7.5 Tf ${xFila} ${y} Td (${escaparPdfTexto(celdaTxt)}) Tj ET`);
      xFila += anchos[i];
    }
    y -= 13;
  }

  const streamContent = lineas.join('\n');
  const streamBuf = Buffer.from(streamContent, 'utf8');

  const objetos = [];
  objetos.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objetos.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  objetos.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj');
  objetos.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');
  objetos.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj');
  objetos.push(`6 0 obj\n<< /Length ${streamBuf.length} >>\nstream\n${streamContent}\nendstream\nendobj`);

  let offset = 9;
  const offsets = [];
  let pdf = '%PDF-1.4\n';

  for (const obj of objetos) {
    offsets.push(offset);
    pdf += obj + '\n';
    offset = Buffer.byteLength(pdf, 'utf8');
  }

  const xrefOffset = offset;
  pdf += 'xref\n0 ' + (objetos.length + 1) + '\n0000000000 65535 f \n';
  for (const off of offsets) {
    pdf += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

const formatearFechaDdMmYyyy = (f) => {
  if (!f) return '—';
  const str = String(f).slice(0, 10);
  const partes = str.split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return str;
};

async function obtenerDatosReporte(tipo) {
  if (tipo === 'servicios') {
    const { rows } = await pool.query(`
      SELECT s.id, s.nombre, c.nombre AS cliente, se.nombre AS sede,
             CONCAT(p.nombres, ' ', p.apellidos) AS supervisor,
             s.hora_inicio || ' - ' || s.hora_fin AS horario,
             s.estado,
             TO_CHAR(s.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
             TO_CHAR(s.fecha_fin, 'YYYY-MM-DD') AS fecha_fin
      FROM servicios s
      JOIN clientes c ON s.cliente_id = c.id
      JOIN sedes se ON s.sede_id = se.id
      JOIN personal p ON s.supervisor_id = p.id
      WHERE s.eliminado = FALSE
      ORDER BY s.nombre ASC
    `);
    const columnas = ['ID', 'Servicio', 'Cliente', 'Sede', 'Supervisor', 'Horario', 'Estado', 'Fecha Inicio', 'Fecha Fin'];
    const filas = rows.map((r) => [
      r.id,
      r.nombre,
      r.cliente,
      r.sede,
      r.supervisor,
      r.horario,
      r.estado,
      formatearFechaDdMmYyyy(r.fecha_inicio),
      formatearFechaDdMmYyyy(r.fecha_fin),
    ]);
    return { titulo: 'Reporte Operativo de Servicios', columnas, filas };
  }

  if (tipo === 'turnos') {
    const { rows } = await pool.query(`
      SELECT t.id, TO_CHAR(t.fecha, 'YYYY-MM-DD') AS fecha,
             CONCAT(p.nombres, ' ', p.apellidos) AS personal,
             s.nombre AS servicio, se.nombre AS sede,
             t.hora_inicio || ' - ' || t.hora_fin AS horario,
             t.estado
      FROM turnos t
      JOIN personal p ON t.personal_id = p.id
      JOIN servicios s ON t.servicio_id = s.id
      JOIN sedes se ON t.sede_id = se.id
      WHERE t.eliminado = FALSE
      ORDER BY t.fecha ASC, p.apellidos ASC
    `);
    const columnas = ['ID', 'Fecha', 'Personal', 'Servicio', 'Sede', 'Horario', 'Estado'];
    const filas = rows.map((r) => [
      r.id,
      formatearFechaDdMmYyyy(r.fecha),
      r.personal,
      r.servicio,
      r.sede,
      r.horario,
      r.estado,
    ]);
    return { titulo: 'Reporte de Turnos Planificados', columnas, filas };
  }

  if (tipo === 'incidencias') {
    const { rows } = await pool.query(`
      SELECT i.codigo, ti.nombre AS tipo, s.nombre AS servicio,
             COALESCE(CONCAT(p.nombres, ' ', p.apellidos), u.nombre) AS registrado_por,
             i.prioridad, i.estado,
             TO_CHAR(i.fecha_registro, 'YYYY-MM-DD HH24:MI') AS fecha_registro,
             i.descripcion
      FROM incidencias i
      JOIN tipos_incidencia ti ON i.tipo_incidencia_id = ti.id
      JOIN servicios s ON i.servicio_id = s.id
      LEFT JOIN personal p ON i.personal_id = p.id
      LEFT JOIN usuarios u ON i.registrado_por = u.id
      WHERE i.eliminado = FALSE
      ORDER BY i.codigo ASC
    `);
    const columnas = ['Código', 'Tipo', 'Servicio', 'Registrado Por', 'Prioridad', 'Estado', 'Fecha Registro', 'Descripción'];
    const filas = rows.map((r) => [
      r.codigo,
      r.tipo,
      r.servicio,
      r.registrado_por,
      r.prioridad,
      r.estado,
      r.fecha_registro ? `${formatearFechaDdMmYyyy(r.fecha_registro.slice(0, 10))} ${r.fecha_registro.slice(11)}` : '—',
      r.descripcion,
    ]);
    return { titulo: 'Reporte de Incidencias Operativas', columnas, filas };
  }

  if (tipo === 'multicriterio') {
    const { rows } = await pool.query(`
      SELECT s.nombre AS servicio, em.puntaje_global, em.nivel,
             TO_CHAR(em.fecha_evaluacion, 'YYYY-MM-DD') AS fecha
      FROM evaluaciones_multicriterio em
      JOIN servicios s ON em.servicio_id = s.id
      WHERE em.eliminado = FALSE
      ORDER BY s.nombre ASC
    `);
    const columnas = ['Servicio', 'Puntaje Global', 'Nivel de Atención', 'Fecha Evaluación'];
    const filas = rows.map((r) => [
      r.servicio,
      r.puntaje_global,
      r.nivel.toUpperCase(),
      formatearFechaDdMmYyyy(r.fecha),
    ]);
    return { titulo: 'Reporte de Evaluación Multicriterio (MCDA)', columnas, filas };
  }

  const { rows } = await pool.query(`
    SELECT s.nombre AS servicio,
           ROUND(COUNT(t.id) FILTER (WHERE t.estado = 'cumplido')::NUMERIC / NULLIF(COUNT(t.id), 0) * 100, 1) AS cumplimiento_pct,
           COUNT(i.id) FILTER (WHERE i.estado != 'cerrada' AND i.eliminado = FALSE) AS incidencias
    FROM servicios s
    LEFT JOIN turnos t ON t.servicio_id = s.id AND t.eliminado = FALSE
    LEFT JOIN incidencias i ON i.servicio_id = s.id
    WHERE s.eliminado = FALSE
    GROUP BY s.id, s.nombre
    ORDER BY s.nombre ASC
  `);
  const columnas = ['Servicio', 'Cumplimiento %', 'Incidencias Abiertas'];
  const filas = rows.map((r) => [
    r.servicio,
    `${r.cumplimiento_pct || 0}%`,
    r.incidencias || 0,
  ]);
  return { titulo: 'Reporte de Indicadores BI y Desempeño', columnas, filas };
}

module.exports = {
  generarXlsx,
  generarPdf,
  obtenerDatosReporte,
};

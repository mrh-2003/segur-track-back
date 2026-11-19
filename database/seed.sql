-- Tras las migraciones, completar los flujos KPI de una base demo con npm run db:demo:kpis.
-- Ejemplos relativos al día actual de Lima. Revisión: 18/11/2026.
SET TIME ZONE 'America/Lima';
TRUNCATE TABLE
  verificaciones_consignas,
  rondas,
  consignas,
  evidencias_servicio,
  servicio_requerimientos,
  servicio_protocolos,
  protocolos,
  evaluacion_criterios,
  evaluaciones_multicriterio,
  reportes_generados,
  actividad_reciente,
  incidencias,
  turnos,
  servicio_personal,
  servicios,
  personal,
  clientes,
  sedes,
  usuarios,
  criterios_mcda,
  tipos_incidencia
RESTART IDENTITY CASCADE;

INSERT INTO usuarios (id, nombre, correo, clave_hash, rol, activo, debe_cambiar_clave) VALUES
(1, 'Administrador Sistema', 'admin@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'administrador', TRUE, FALSE),
(2, 'María Torres', 'mtorres@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'supervisor', TRUE, FALSE),
(3, 'Juan López', 'jlopez@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE),
(4, 'Carla Álvarez', 'calvarez@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE),
(5, 'Diego Rojas', 'drojas@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE),
(6, 'Lucía Sánchez', 'lsanchez@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', FALSE, FALSE),
(7, 'Pablo Contreras', 'pcontreras@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE),
(8, 'Carla Ruiz', 'cruiz@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE),
(9, 'Ana Pérez', 'aperez@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE),
(10, 'Luis García', 'lgarcia@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE),
(11, 'Carla Gómez', 'cgomez@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'supervisor', TRUE, FALSE),
(12, 'Miguel Sánchez', 'msanchez@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'supervisor', TRUE, FALSE),
(13, 'Laura Gómez', 'lgomez@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'supervisor', TRUE, FALSE),
(14, 'Roberto Mendoza', 'rmendoza@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE),
(15, 'Elena Castro', 'ecastro@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE),
(16, 'Fernando Quispe', 'fquispe@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE),
(17, 'Patricia Flores', 'pflores@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE),
(18, 'Carlos Vega', 'cvega@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE),
(19, 'Andrea Morales', 'amorales@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE),
(20, 'José Herrera', 'jherrera@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'supervisor', TRUE, FALSE),
(21, 'Sofia Reyes', 'sreyes@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE),
(22, 'Carlos Mendoza', 'jefe@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'jefe_operaciones', TRUE, FALSE);
SELECT setval('usuarios_id_seq', 22);

INSERT INTO sedes (id, nombre, direccion) VALUES
  (1, 'Centro Logístico Norte', 'Av. Industrial 1200, Zona Norte'),
  (2, 'Oficinas Corporativas', 'Jr. Los Álamos 450, San Isidro'),
  (3, 'Planta Sur', 'Carretera Panamericana Sur Km 23');
SELECT setval('sedes_id_seq', 3);

INSERT INTO clientes (id, nombre, contacto) VALUES
  (1, 'Centro Logístico', 'contacto@centrologistico.com'),
  (2, 'Torres Corp.', 'gerencia@torrescorp.com'),
  (3, 'Parque Industrial', 'admin@parqueindustrial.com'),
  (4, 'Grupo Andino', 'operaciones@grupoandino.com'),
  (5, 'LogiTrans', 'logistica@logitrans.com');
SELECT setval('clientes_id_seq', 5);

INSERT INTO personal (id, nombres, apellidos, documento, cargo, estado, correo, sede_id, usuario_id) VALUES
(1, 'María', 'Torres', '32456789', 'supervisor', 'activo', 'mtorres@segurtrack.com', 1, 2),
(2, 'Juan', 'López', '28341776', 'agente', 'activo', 'jlopez@segurtrack.com', 1, 3),
(3, 'Carla', 'Álvarez', '41987653', 'agente', 'activo', 'calvarez@segurtrack.com', 2, 4),
(4, 'Diego', 'Rojas', '37112445', 'agente', 'activo', 'drojas@segurtrack.com', 1, 5),
(5, 'Lucía', 'Sánchez', '29667221', 'administrativo', 'inactivo', 'lsanchez@segurtrack.com', 2, 6),
(6, 'Pablo', 'Contreras', '36554998', 'agente', 'activo', 'pcontreras@segurtrack.com', 3, 7),
(7, 'Carla', 'Ruiz', '40123456', 'agente', 'activo', 'cruiz@segurtrack.com', 1, 8),
(8, 'Ana', 'Pérez', '35678901', 'agente', 'activo', 'aperez@segurtrack.com', 2, 9),
(9, 'Luis', 'García', '42345678', 'agente', 'activo', 'lgarcia@segurtrack.com', 3, 10),
(10, 'Carla', 'Gómez', '38901234', 'supervisor', 'activo', 'cgomez@segurtrack.com', 3, 11),
(11, 'Miguel', 'Sánchez', '31234567', 'supervisor', 'activo', 'msanchez@segurtrack.com', 2, 12),
(12, 'Laura', 'Gómez', '39012345', 'supervisor', 'activo', 'lgomez@segurtrack.com', 1, 13),
(13, 'Roberto', 'Mendoza', '44567890', 'agente', 'activo', 'rmendoza@segurtrack.com', 1, 14),
(14, 'Elena', 'Castro', '33456789', 'agente', 'activo', 'ecastro@segurtrack.com', 2, 15),
(15, 'Fernando', 'Quispe', '45678901', 'agente', 'activo', 'fquispe@segurtrack.com', 3, 16),
(16, 'Patricia', 'Flores', '34567890', 'agente', 'activo', 'pflores@segurtrack.com', 1, 17),
(17, 'Carlos', 'Vega', '46789012', 'agente', 'activo', 'cvega@segurtrack.com', 2, 18),
(18, 'Andrea', 'Morales', '35678902', 'agente', 'activo', 'amorales@segurtrack.com', 3, 19),
(19, 'José', 'Herrera', '47890123', 'supervisor', 'activo', 'jherrera@segurtrack.com', 1, 20),
(20, 'Sofia', 'Reyes', '36789012', 'agente', 'activo', 'sreyes@segurtrack.com', 2, 21),
(21, 'Carlos', 'Mendoza', '10293847', 'jefe_operaciones', 'activo', 'jefe@segurtrack.com', 1, 22);
SELECT setval('personal_id_seq', 21);

INSERT INTO servicios (id, nombre, cliente_id, sede_id, supervisor_id, hora_inicio, hora_fin, estado, fecha_inicio, fecha_fin) VALUES
  (1,  'Vigilancia principal',  1, 1, 1,  '06:00', '14:00', 'en_curso',   CURRENT_DATE - INTERVAL '60 days', NULL),
  (2,  'Control de accesos',    2, 2, 11, '14:00', '22:00', 'programado', CURRENT_DATE - INTERVAL '40 days', NULL),
  (3,  'Ronda perimetral',      3, 3, 10, '22:00', '06:00', 'en_curso',   CURRENT_DATE - INTERVAL '30 days', NULL),
  (4,  'Recepción',             4, 2, 11, '08:00', '16:00', 'programado', CURRENT_DATE - INTERVAL '20 days', NULL),
  (5,  'Monitoreo CCTV',        5, 1, 12, '00:00', '23:59', 'finalizado', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE - INTERVAL '5 days'),
  (6,  'Acceso Norte',          1, 1, 1,  '06:00', '14:00', 'en_curso',   CURRENT_DATE - INTERVAL '25 days', NULL),
  (7,  'Vigilancia Exteriores', 3, 3, 10, '14:00', '22:00', 'en_curso',   CURRENT_DATE - INTERVAL '18 days', NULL),
  (8,  'Control de Accesos 2',  2, 2, 11, '22:00', '06:00', 'en_curso',   CURRENT_DATE - INTERVAL '12 days', NULL),
  (9,  'Rondas Nocturnas',      4, 3, 10, '22:00', '06:00', 'en_curso',   CURRENT_DATE - INTERVAL '8 days',  NULL),
  (10, 'Recepción Principal',   5, 2, 11, '08:00', '16:00', 'programado', CURRENT_DATE - INTERVAL '5 days',  NULL);
SELECT setval('servicios_id_seq', 10);

INSERT INTO servicio_personal (servicio_id, personal_id) VALUES
  (1,2),(1,4),(1,7),(1,13),(1,16),(1,19),
  (2,3),(2,14),(2,17),
  (3,6),(3,9),(3,15),(3,18),
  (4,5),(4,8),
  (6,2),(6,4),
  (7,6),(7,9),
  (8,3),(8,7),
  (9,6),(9,15),
  (10,8),(10,14);

INSERT INTO turnos (personal_id, servicio_id, sede_id, fecha, hora_inicio, hora_fin, estado, relevo_pendiente)
SELECT
  p.id,
  s.id,
  s.sede_id,
  CURRENT_DATE - (w * 7 + d || ' days')::INTERVAL,
  s.hora_inicio,
  s.hora_fin,
  'cumplido',
  FALSE
FROM (VALUES (1,1),(2,1),(3,2),(6,3),(7,3),(8,2),(13,1),(14,2),(15,3)) AS map(personal_id, servicio_id)
JOIN personal p ON p.id = map.personal_id
JOIN servicios s ON s.id = map.servicio_id
CROSS JOIN generate_series(1, 8) AS w
CROSS JOIN generate_series(0, 2) AS d;

INSERT INTO turnos (personal_id, servicio_id, sede_id, fecha, hora_inicio, hora_fin, estado, relevo_pendiente)
SELECT
  map.personal_id,
  map.servicio_id,
  map.sede_id,
  (DATE_TRUNC('week', CURRENT_DATE)::DATE + dia.desplazamiento),
  map.hora_inicio,
  map.hora_fin,
  CASE
    WHEN (DATE_TRUNC('week', CURRENT_DATE)::DATE + dia.desplazamiento) < CURRENT_DATE THEN 'cumplido'
    WHEN (DATE_TRUNC('week', CURRENT_DATE)::DATE + dia.desplazamiento) > CURRENT_DATE THEN 'programado'
    ELSE map.estado_hoy
  END,
  CASE
    WHEN (DATE_TRUNC('week', CURRENT_DATE)::DATE + dia.desplazamiento) = CURRENT_DATE THEN map.relevo_hoy
    ELSE FALSE
  END
FROM (
  VALUES
    (1,  1, 1, '06:00'::TIME, '14:00'::TIME, 'confirmado',    FALSE),
    (2,  1, 1, '14:00'::TIME, '22:00'::TIME, 'sin_confirmar', FALSE),
    (7,  3, 1, '22:00'::TIME, '06:00'::TIME, 'confirmado',    TRUE),
    (8,  2, 2, '06:00'::TIME, '14:00'::TIME, 'pendiente',     FALSE),
    (3,  2, 2, '14:00'::TIME, '22:00'::TIME, 'confirmado',    FALSE),
    (6,  3, 3, '22:00'::TIME, '06:00'::TIME, 'confirmado',    FALSE),
    (9,  9, 3, '14:00'::TIME, '22:00'::TIME, 'confirmado',    FALSE),
    (13, 1, 1, '06:00'::TIME, '14:00'::TIME, 'confirmado',    FALSE),
    (14, 2, 2, '14:00'::TIME, '22:00'::TIME, 'confirmado',    FALSE),
    (15, 3, 3, '22:00'::TIME, '06:00'::TIME, 'confirmado',    FALSE),
    (16, 1, 1, '06:00'::TIME, '14:00'::TIME, 'confirmado',    FALSE),
    (17, 2, 2, '14:00'::TIME, '22:00'::TIME, 'confirmado',    FALSE),
    (18, 3, 3, '22:00'::TIME, '06:00'::TIME, 'programado',    FALSE)
) AS map(personal_id, servicio_id, sede_id, hora_inicio, hora_fin, estado_hoy, relevo_hoy)
CROSS JOIN generate_series(0, 6) AS dia(desplazamiento);

INSERT INTO tipos_incidencia (id, nombre) VALUES
  (1, 'Acceso no autorizado'),
  (2, 'Falla de equipo'),
  (3, 'Evento de seguridad'),
  (4, 'Conducta inadecuada'),
  (5, 'Alarma activada'),
  (6, 'Incumplimiento de turno'),
  (7, 'Otros');
SELECT setval('tipos_incidencia_id_seq', 7);

INSERT INTO incidencias (codigo, tipo_incidencia_id, servicio_id, personal_id, descripcion, prioridad, estado, fecha_registro, fecha_atencion, fecha_cierre, registrado_por) VALUES
  ('INC-0001', 6, 2, 1, 'Agente no se presentó a su turno asignado en Oficinas Corp.', 'media', 'cerrada',
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '40 minutes', NOW() - INTERVAL '3 days' + INTERVAL '2 hours', 2),
  ('INC-0002', 5, 1, 2, 'Activación de alarma perimetral en zona norte sin causa aparente.', 'alta', 'en_atencion',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '30 minutes', NULL, 3),
  ('INC-0003', 4, 3, 10, 'Reporte de conducta inadecuada de personal en turno nocturno.', 'baja', 'cerrada',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '25 minutes', NOW() - INTERVAL '2 days' + INTERVAL '3 hours', 11),
  ('INC-0004', 2, 2, 1, 'Falla en sistema de control de accesos. Torniquete bloqueado.', 'media', 'en_atencion',
   NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours', NULL, 2),
  ('INC-0005', 1, 1, 2, 'Persona no autorizada detectada en zona de carga del almacén.', 'alta', 'abierta',
   NOW() - INTERVAL '1 hour', NULL, NULL, 3),
  ('INC-0006', 3, 3, 10, 'Evento de seguridad reportado en acceso principal de planta.', 'alta', 'cerrada',
   NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days' + INTERVAL '30 minutes', NOW() - INTERVAL '4 days' + INTERVAL '4 hours', 11),
  ('INC-0007', 5, 7, 6, 'Sensor de movimiento activado en perímetro sur durante ronda.', 'media', 'cerrada',
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '20 minutes', NOW() - INTERVAL '5 days' + INTERVAL '1 hour', 2),
  ('INC-0008', 2, 8, 3, 'Cámara domo 04 fuera de línea en control de accesos 2.', 'baja', 'cerrada',
   NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days' + INTERVAL '35 minutes', NOW() - INTERVAL '6 days' + INTERVAL '2 hours', 2),
  ('INC-0009', 1, 9, 15, 'Intento de ingreso por puerta lateral fuera de horario de operaciones.', 'alta', 'en_atencion',
   NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours', NULL, 3),
  ('INC-0010', 6, 10, 8, 'Retraso de 30 minutos en toma de servicio en recepción.', 'media', 'abierta',
   NOW() - INTERVAL '35 minutes', NULL, NULL, 2);
SELECT setval('seq_incidencias', 10);

INSERT INTO criterios_mcda (id, codigo, nombre, descripcion, peso, activo) VALUES
  (1, 'C01', 'Puntualidad y asistencia',                'Presencia a tiempo y cobertura de turnos programados',                   0.200, TRUE),
  (2, 'C02', 'Cumplimiento de protocolos y consignas',  'Ejecución conforme de protocolos de seguridad y consignas del servicio', 0.200, TRUE),
  (3, 'C03', 'Cumplimiento de actividades y rondas',    'Realización de actividades planificadas y rondas de vigilancia',         0.200, TRUE),
  (4, 'C04', 'Cumplimiento de reportes operativos',     'Entrega oportuna y dentro del plazo de reportes operativos del turno',   0.200, TRUE),
  (5, 'C05', 'Gestión de incidencias',                  'Resolución y atención dentro del plazo de las incidencias registradas',  0.200, TRUE);
SELECT setval('criterios_mcda_id_seq', 5);

INSERT INTO evaluaciones_multicriterio (id, servicio_id, fecha_evaluacion, puntaje_global, nivel) VALUES
  (1, 7,  NOW() - INTERVAL '1 hour', 36.00, 'alta'),
  (2, 9,  NOW() - INTERVAL '1 hour', 54.00, 'media'),
  (3, 10, NOW() - INTERVAL '1 hour', 55.00, 'media'),
  (4, 5,  NOW() - INTERVAL '1 hour', 68.00, 'media'),
  (5, 6,  NOW() - INTERVAL '1 hour', 75.00, 'baja'),
  (6, 2,  NOW() - INTERVAL '1 hour', 81.00, 'baja');
SELECT setval('evaluaciones_multicriterio_id_seq', 6);

INSERT INTO evaluacion_criterios (evaluacion_id, criterio_id, puntaje, influye) VALUES
  (1,1,40.00,TRUE),  (1,2,25.00,TRUE),  (1,3,30.00,TRUE),  (1,4,50.00,TRUE),  (1,5,35.00,TRUE),
  (2,1,55.00,FALSE), (2,2,60.00,FALSE), (2,3,45.00,TRUE),  (2,4,55.00,FALSE), (2,5,55.00,FALSE),
  (3,1,50.00,TRUE),  (3,2,65.00,FALSE), (3,3,40.00,TRUE),  (3,4,70.00,FALSE), (3,5,50.00,TRUE),
  (4,1,80.00,FALSE), (4,2,75.00,FALSE), (4,3,70.00,FALSE), (4,4,55.00,FALSE), (4,5,60.00,FALSE),
  (5,1,90.00,FALSE), (5,2,80.00,FALSE), (5,3,80.00,FALSE), (5,4,70.00,FALSE), (5,5,55.00,FALSE),
  (6,1,85.00,FALSE), (6,2,80.00,FALSE), (6,3,85.00,FALSE), (6,4,78.00,FALSE), (6,5,77.00,FALSE);

INSERT INTO reportes_generados (tipo, categoria, formato, estado, generado_por, creado_en) VALUES
  ('servicios',     'operativos',    'xlsx', 'completado', 1, NOW() - INTERVAL '2 days'),
  ('turnos',        'operativos',    'pdf',  'completado', 1, NOW() - INTERVAL '1 day'),
  ('incidencias',   'incidencias',   'xlsx', 'completado', 1, NOW() - INTERVAL '5 hours'),
  ('multicriterio', 'multicriterio', 'xlsx', 'completado', 1, NOW() - INTERVAL '1 hour');

INSERT INTO actividad_reciente (tipo, descripcion, usuario_id, creado_en) VALUES
  ('incidencia_registrada', 'Incidencia INC-0010 registrada en Recepción Principal', 2, NOW() - INTERVAL '35 minutes'),
  ('incidencia_registrada', 'Incidencia INC-0005 registrada en Vigilancia principal', 3, NOW() - INTERVAL '1 hour'),
  ('servicio_iniciado',     'Servicio Vigilancia principal iniciado',                  1, NOW() - INTERVAL '2 hours'),
  ('turno_asignado',        'Turno asignado a María Torres para hoy',                  1, NOW() - INTERVAL '3 hours'),
  ('incidencia_atendida',   'Incidencia INC-0004 en atención por equipo técnico',      2, NOW() - INTERVAL '5 hours'),
  ('turno_confirmado',      'Turno confirmado para Juan López',                        2, NOW() - INTERVAL '8 hours'),
  ('personal_creado',       'Nuevo personal Fernando Quispe registrado',               1, NOW() - INTERVAL '12 hours'),
  ('reporte_generado',      'Reporte operativo semanal exportado',                     1, NOW() - INTERVAL '16 hours'),
  ('ronda_completada',      'Ronda perimetral este finalizada con éxito',              2, NOW() - INTERVAL '20 hours'),
  ('servicio_programado',   'Servicio Recepción Principal programado',                 1, NOW() - INTERVAL '23 hours');

INSERT INTO protocolos (id, codigo, nombre, descripcion, actividades, activo) VALUES
  (1, 'PROT-001', 'Control de Accesos y Registro', 'Procedimiento para ingreso y salida vehicular y peatonal', '1. Solicitar identificación oficial. 2. Verificar autorización previa. 3. Registrar hora y motivo. 4. Inspeccionar maleteros o paquetes.', TRUE),
  (2, 'PROT-002', 'Ronda Perimetral de Seguridad', 'Lineamientos de patrullaje preventivo de instalaciones', '1. Recorrido a pie cada 60 minutos. 2. Verificación de cerraduras y puertas de emergencia. 3. Cotejo de sensores perimetrales. 4. Notificar novedades.', TRUE),
  (3, 'PROT-003', 'Respuesta ante Activación de Alarmas', 'Acciones inmediatas ante señales de intrusión o pánico', '1. Comunicar a central receptora. 2. Desplazamiento seguro a la zona. 3. Confirmar causa de la activación. 4. Reportar incidencia en sistema.', TRUE),
  (4, 'PROT-004', 'Inspección de Equipos y Activos', 'Verificación física de infraestructura y activos críticos', '1. Revisar estado de extintores y gabinetes. 2. Comprobar operatividad de cámaras. 3. Verificar sellos y precintos de seguridad.', TRUE);
SELECT setval('protocolos_id_seq', 4);

INSERT INTO servicio_protocolos (servicio_id, protocolo_id) VALUES
  (6, 1),
  (6, 2),
  (7, 1),
  (7, 3),
  (8, 2),
  (8, 4),
  (9, 1),
  (9, 2),
  (10, 1),
  (10, 2),
  (10, 3);

INSERT INTO servicio_requerimientos (servicio_id, titulo, descripcion, prioridad) VALUES
  (6, 'Portar credencial visible', 'El personal debe mantener fotocheck en lugar visible en todo momento', 'alta'),
  (6, 'Uso de equipo de protección', 'Uso obligatorio de chaleco reflectivo y calzado con punta de acero', 'media'),
  (7, 'Reporte radial cada 30 minutos', 'Confirmar estado operacional con la central de seguridad', 'alta'),
  (8, 'Control vehicular con bitácora', 'Registrar placas y kilometraje de cada unidad que sale de la planta', 'media'),
  (10, 'Revisión nocturna de puertas', 'Cierre y comprobación de pasadores de 22:00 a 06:00 horas', 'alta');

INSERT INTO evidencias_servicio (servicio_id, protocolo_id, personal_id, titulo, descripcion, archivo_url, estado_revision, observacion, revisado_por, fecha_revision, creado_en) VALUES
  (6, 1, 3, 'Registro de visita transportista', 'Se validó guía de remisión N° 45812 y DNI de conductor en puerta 1', 'https://ik.imagekit.io/segurtrack/evidencias/guia_45812.jpg', 'aprobada', 'Registro completo con datos verificados', 2, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '4 hours'),
  (6, 2, 4, 'Ronda perimetral este', 'Puerta posterior de emergencia encontrada asegurada correctamente', 'https://ik.imagekit.io/segurtrack/evidencias/ronda_este.jpg', 'aprobada', 'Conforme sin novedades', 2, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '3 hours'),
  (10, 3, 3, 'Falsa alarma sensor de movimiento', 'Causada por ráfaga de viento en almacén 3. Se descartó intrusión.', 'https://ik.imagekit.io/segurtrack/evidencias/alarma_sensor.jpg', 'observada', 'Se requiere reubicar sensor hacia zona interna', 2, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '2 hours'),
  (8, 2, 5, 'Ronda sector estacionamientos', 'Inspección de vehículos estacionados y luminarias', 'https://ik.imagekit.io/segurtrack/evidencias/estacionamiento.jpg', 'pendiente', NULL, NULL, NULL, NOW() - INTERVAL '30 minutes');

INSERT INTO consignas (id, servicio_id, descripcion, activo) VALUES
  (1,  6,  'Verificar identificación de visitantes antes de permitir el acceso al perímetro norte', TRUE),
  (2,  6,  'Registrar placas de vehículos de carga que ingresen entre las 06:00 y las 14:00',       TRUE),
  (3,  6,  'Comunicar novedades a central de seguridad cada 30 minutos durante el turno',            TRUE),
  (4,  7,  'Realizar patrullaje perimetral exterior completo cada 60 minutos',                       TRUE),
  (5,  7,  'Verificar estado de cerraduras de accesos secundarios al inicio y al fin del turno',    TRUE),
  (6,  7,  'Reportar cualquier presencia no autorizada en el área exterior de inmediato',            TRUE),
  (7,  8,  'Controlar acceso vehicular con bitácora física y registro fotográfico de placas',        TRUE),
  (8,  8,  'Verificar que todo personal de planta porte credencial visible durante su jornada',     TRUE),
  (9,  9,  'Efectuar ronda nocturna perimetral completa a las 22:30, 00:30 y 02:30',                TRUE),
  (10, 9,  'Asegurar cierre de portones de servicio antes del inicio de la ronda nocturna',          TRUE),
  (11, 10, 'Registrar el ingreso y salida de visitantes en el sistema de recepción con DNI',         TRUE),
  (12, 10, 'Notificar al área de destino la llegada de cada visitante antes de autorizar el pase',   TRUE);
SELECT setval('consignas_id_seq', 12);

INSERT INTO verificaciones_consignas (turno_id, consigna_id, cumplida, observacion, verificado_por)
SELECT
  t.id,
  c.id,
  CASE WHEN c.id IN (1,2,4,7,9,11) THEN TRUE ELSE FALSE END,
  CASE WHEN c.id NOT IN (1,2,4,7,9,11) THEN 'No se pudo verificar durante el turno' ELSE NULL END,
  1
FROM turnos t
JOIN consignas c ON c.servicio_id = t.servicio_id AND c.eliminado = FALSE
WHERE t.eliminado = FALSE
  AND t.estado IN ('cumplido','confirmado')
  AND t.fecha >= CURRENT_DATE - INTERVAL '7 days'
  AND t.fecha <= CURRENT_DATE;

UPDATE turnos SET rondas_requeridas = 2, rondas_completadas = 2
WHERE servicio_id = 6 AND estado = 'cumplido' AND eliminado = FALSE
  AND fecha >= CURRENT_DATE - INTERVAL '7 days';

UPDATE turnos SET rondas_requeridas = 2, rondas_completadas = 1
WHERE servicio_id = 7 AND estado = 'cumplido' AND eliminado = FALSE
  AND fecha >= CURRENT_DATE - INTERVAL '7 days';

UPDATE turnos SET rondas_requeridas = 2, rondas_completadas = 2
WHERE servicio_id = 9 AND estado IN ('cumplido','confirmado') AND eliminado = FALSE
  AND fecha >= CURRENT_DATE - INTERVAL '7 days';

UPDATE turnos SET rondas_requeridas = 2, rondas_completadas = 0
WHERE servicio_id = 8 AND estado = 'cumplido' AND eliminado = FALSE
  AND fecha >= CURRENT_DATE - INTERVAL '7 days';

WITH turno_actual AS (
  SELECT t.id AS tid, t.servicio_id AS sid
  FROM turnos t
  WHERE t.eliminado = FALSE
    AND t.servicio_id IN (6,7,9)
    AND t.fecha = CURRENT_DATE
  LIMIT 3
)
INSERT INTO rondas (turno_id, servicio_id, fecha_programada, fecha_completada, ruta, observaciones, estado, creado_por)
SELECT
  ta.tid,
  ta.sid,
  NOW() - INTERVAL '3 hours',
  NOW() - INTERVAL '2 hours 45 minutes',
  CASE ta.sid
    WHEN 6 THEN 'Acceso Norte → Puerta lateral → Estacionamiento → Retorno'
    WHEN 7 THEN 'Exterior Oeste → Exterior Sur → Exterior Este → Retorno'
    WHEN 9 THEN 'Portón principal → Área de carga → Almacenes → Retorno'
  END,
  'Sin novedades durante el recorrido',
  'completada',
  1
FROM turno_actual ta
UNION ALL
SELECT
  ta.tid,
  ta.sid,
  NOW() - INTERVAL '1 hour',
  NOW() - INTERVAL '45 minutes',
  CASE ta.sid
    WHEN 6 THEN 'Acceso Norte → Puerta lateral → Estacionamiento → Retorno'
    WHEN 7 THEN 'Exterior Oeste → Exterior Sur → Exterior Este → Retorno'
    WHEN 9 THEN 'Portón principal → Área de carga → Almacenes → Retorno'
  END,
  'Sin novedades durante el recorrido',
  'completada',
  1
FROM turno_actual ta;

WITH turno_serv8 AS (
  SELECT t.id AS tid
  FROM turnos t
  WHERE t.eliminado = FALSE AND t.servicio_id = 8 AND t.fecha = CURRENT_DATE
  LIMIT 1
)
INSERT INTO rondas (turno_id, servicio_id, fecha_programada, fecha_completada, ruta, observaciones, estado, creado_por)
SELECT
  ts.tid,
  8,
  NOW() - INTERVAL '2 hours',
  NULL::TIMESTAMPTZ,
  'Estacionamiento → Acceso vehículos → Planta → Retorno',
  NULL,
  'programada',
  1
FROM turno_serv8 ts
UNION ALL
SELECT
  ts.tid,
  8,
  NOW() + INTERVAL '1 hour',
  NULL::TIMESTAMPTZ,
  'Estacionamiento → Acceso vehículos → Planta → Retorno',
  NULL,
  'programada',
  1
FROM turno_serv8 ts;

WITH turnos_hist AS (
  SELECT t.id AS tid, t.servicio_id AS sid,
         ROW_NUMBER() OVER (PARTITION BY t.servicio_id ORDER BY t.fecha DESC) AS rn
  FROM turnos t
  WHERE t.eliminado = FALSE
    AND t.servicio_id IN (6,7,9)
    AND t.fecha BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE - INTERVAL '1 day'
    AND t.estado = 'cumplido'
)
INSERT INTO rondas (turno_id, servicio_id, fecha_programada, fecha_completada, ruta, observaciones, estado, creado_por)
SELECT
  th.tid,
  th.sid,
  (t.fecha + INTERVAL '3 hours')::TIMESTAMPTZ,
  (t.fecha + INTERVAL '3 hours 20 minutes')::TIMESTAMPTZ,
  'Ruta estándar del servicio',
  'Ronda completada sin novedades',
  'completada',
  1
FROM turnos_hist th
JOIN turnos t ON t.id = th.tid
WHERE th.rn <= 3
UNION ALL
SELECT
  th.tid,
  th.sid,
  (t.fecha + INTERVAL '6 hours')::TIMESTAMPTZ,
  CASE WHEN th.sid = 7 THEN NULL ELSE (t.fecha + INTERVAL '6 hours 25 minutes')::TIMESTAMPTZ END,
  'Ruta estándar del servicio',
  CASE WHEN th.sid = 7 THEN NULL ELSE 'Ronda completada sin novedades' END,
  CASE WHEN th.sid = 7 THEN 'omitida' ELSE 'completada' END,
  1
FROM turnos_hist th
JOIN turnos t ON t.id = th.tid
WHERE th.rn <= 3;

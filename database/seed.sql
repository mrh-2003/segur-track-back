TRUNCATE TABLE
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
(1, 'Administrador Sistema', 'admin@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'administrador', TRUE, FALSE), -- Contraseña: Admin1234
(2, 'María Torres', 'mtorres@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'supervisor', TRUE, FALSE), -- Contraseña: Admin1234
(3, 'Juan López', 'jlopez@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE), -- Contraseña: Admin1234
(4, 'Carla Álvarez', 'calvarez@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE), -- Contraseña: Admin1234
(5, 'Diego Rojas', 'drojas@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE), -- Contraseña: Admin1234
(6, 'Lucía Sánchez', 'lsanchez@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', FALSE, FALSE), -- Contraseña: Admin1234
(7, 'Pablo Contreras', 'pcontreras@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE), -- Contraseña: Admin1234
(8, 'Carla Ruiz', 'cruiz@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE), -- Contraseña: Admin1234
(9, 'Ana Pérez', 'aperez@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE), -- Contraseña: Admin1234
(10, 'Luis García', 'lgarcia@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE), -- Contraseña: Admin1234
(11, 'Carla Gómez', 'cgomez@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'supervisor', TRUE, FALSE), -- Contraseña: Admin1234
(12, 'Miguel Sánchez', 'msanchez@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'supervisor', TRUE, FALSE), -- Contraseña: Admin1234
(13, 'Laura Gómez', 'lgomez@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'supervisor', TRUE, FALSE), -- Contraseña: Admin1234
(14, 'Roberto Mendoza', 'rmendoza@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE), -- Contraseña: Admin1234
(15, 'Elena Castro', 'ecastro@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE), -- Contraseña: Admin1234
(16, 'Fernando Quispe', 'fquispe@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE), -- Contraseña: Admin1234
(17, 'Patricia Flores', 'pflores@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE), -- Contraseña: Admin1234
(18, 'Carlos Vega', 'cvega@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE), -- Contraseña: Admin1234
(19, 'Andrea Morales', 'amorales@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE), -- Contraseña: Admin1234
(20, 'José Herrera', 'jherrera@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'supervisor', TRUE, FALSE), -- Contraseña: Admin1234
(21, 'Sofia Reyes', 'sreyes@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'operador', TRUE, FALSE), -- Contraseña: Admin1234
(22, 'Carlos Mendoza', 'jefe@segurtrack.com', '$2a$10$tBXOKWDXenxuSBcsyI/KaezbJ2xSpMH6VJ0pk2C3dMuRft2QsVa7u', 'jefe_operaciones', TRUE, FALSE); -- Contraseña: Admin1234
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
(1, 'María', 'Torres', '32456789', 'supervisor', 'activo', 'mtorres@segurtrack.com', 1, 2), -- Contraseña: Admin1234
(2, 'Juan', 'López', '28341776', 'agente', 'activo', 'jlopez@segurtrack.com', 1, 3), -- Contraseña: Admin1234
(3, 'Carla', 'Álvarez', '41987653', 'agente', 'activo', 'calvarez@segurtrack.com', 2, 4), -- Contraseña: Admin1234
(4, 'Diego', 'Rojas', '37112445', 'agente', 'activo', 'drojas@segurtrack.com', 1, 5), -- Contraseña: Admin1234
(5, 'Lucía', 'Sánchez', '29667221', 'administrativo', 'inactivo', 'lsanchez@segurtrack.com', 2, 6), -- Contraseña: Admin1234
(6, 'Pablo', 'Contreras', '36554998', 'agente', 'activo', 'pcontreras@segurtrack.com', 3, 7), -- Contraseña: Admin1234
(7, 'Carla', 'Ruiz', '40123456', 'agente', 'activo', 'cruiz@segurtrack.com', 1, 8), -- Contraseña: Admin1234
(8, 'Ana', 'Pérez', '35678901', 'agente', 'activo', 'aperez@segurtrack.com', 2, 9), -- Contraseña: Admin1234
(9, 'Luis', 'García', '42345678', 'agente', 'activo', 'lgarcia@segurtrack.com', 3, 10), -- Contraseña: Admin1234
(10, 'Carla', 'Gómez', '38901234', 'supervisor', 'activo', 'cgomez@segurtrack.com', 3, 11), -- Contraseña: Admin1234
(11, 'Miguel', 'Sánchez', '31234567', 'supervisor', 'activo', 'msanchez@segurtrack.com', 2, 12), -- Contraseña: Admin1234
(12, 'Laura', 'Gómez', '39012345', 'supervisor', 'activo', 'lgomez@segurtrack.com', 1, 13), -- Contraseña: Admin1234
(13, 'Roberto', 'Mendoza', '44567890', 'agente', 'activo', 'rmendoza@segurtrack.com', 1, 14), -- Contraseña: Admin1234
(14, 'Elena', 'Castro', '33456789', 'agente', 'activo', 'ecastro@segurtrack.com', 2, 15), -- Contraseña: Admin1234
(15, 'Fernando', 'Quispe', '45678901', 'agente', 'activo', 'fquispe@segurtrack.com', 3, 16), -- Contraseña: Admin1234
(16, 'Patricia', 'Flores', '34567890', 'agente', 'activo', 'pflores@segurtrack.com', 1, 17), -- Contraseña: Admin1234
(17, 'Carlos', 'Vega', '46789012', 'agente', 'activo', 'cvega@segurtrack.com', 2, 18), -- Contraseña: Admin1234
(18, 'Andrea', 'Morales', '35678902', 'agente', 'activo', 'amorales@segurtrack.com', 3, 19), -- Contraseña: Admin1234
(19, 'José', 'Herrera', '47890123', 'supervisor', 'activo', 'jherrera@segurtrack.com', 1, 20), -- Contraseña: Admin1234
(20, 'Sofia', 'Reyes', '36789012', 'agente', 'activo', 'sreyes@segurtrack.com', 2, 21), -- Contraseña: Admin1234
(21, 'Carlos', 'Mendoza', '10293847', 'jefe_operaciones', 'activo', 'jefe@segurtrack.com', 1, 22); -- Contraseña: Admin1234
SELECT setval('personal_id_seq', 21);

INSERT INTO servicios (id, nombre, cliente_id, sede_id, supervisor_id, hora_inicio, hora_fin, estado, fecha_inicio, fecha_fin) VALUES
  (1,  'Vigilancia principal',  1, 1, 1,  '06:00', '14:00', 'en_curso',   CURRENT_DATE - INTERVAL '30 days', NULL),
  (2,  'Control de accesos',    2, 2, 11, '14:00', '22:00', 'programado', CURRENT_DATE - INTERVAL '20 days', NULL),
  (3,  'Ronda perimetral',      3, 3, 10, '22:00', '06:00', 'en_curso',   CURRENT_DATE - INTERVAL '15 days', NULL),
  (4,  'Recepción',             4, 2, 11, '08:00', '16:00', 'programado', CURRENT_DATE - INTERVAL '10 days', NULL),
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

INSERT INTO turnos (personal_id, servicio_id, sede_id, fecha, hora_inicio, hora_fin, estado, relevo_pendiente) VALUES
  (1,  1, 1, CURRENT_DATE - INTERVAL '2 days', '06:00', '14:00', 'cumplido',      FALSE),
  (1,  1, 1, CURRENT_DATE - INTERVAL '1 day',  '06:00', '14:00', 'cumplido',      FALSE),
  (1,  1, 1, CURRENT_DATE,                     '06:00', '14:00', 'confirmado',    FALSE),
  (1,  1, 1, CURRENT_DATE + INTERVAL '1 day',  '06:00', '14:00', 'programado',    FALSE),
  (1,  1, 1, CURRENT_DATE + INTERVAL '2 days', '06:00', '14:00', 'programado',    FALSE),
  (2,  1, 1, CURRENT_DATE - INTERVAL '2 days', '14:00', '22:00', 'cumplido',      FALSE),
  (2,  1, 1, CURRENT_DATE - INTERVAL '1 day',  '14:00', '22:00', 'cumplido',      FALSE),
  (2,  1, 1, CURRENT_DATE,                     '14:00', '22:00', 'sin_confirmar', FALSE),
  (2,  1, 1, CURRENT_DATE + INTERVAL '1 day',  '14:00', '22:00', 'programado',    TRUE),
  (7,  3, 1, CURRENT_DATE - INTERVAL '1 day',  '22:00', '06:00', 'cumplido',      FALSE),
  (7,  3, 1, CURRENT_DATE,                     '22:00', '06:00', 'confirmado',    FALSE),
  (7,  3, 1, CURRENT_DATE + INTERVAL '1 day',  '22:00', '06:00', 'programado',    FALSE),
  (8,  2, 2, CURRENT_DATE - INTERVAL '2 days', '06:00', '14:00', 'cumplido',      FALSE),
  (8,  2, 2, CURRENT_DATE,                     '06:00', '14:00', 'confirmado',    FALSE),
  (8,  2, 2, CURRENT_DATE + INTERVAL '1 day',  '06:00', '14:00', 'pendiente',     FALSE),
  (9,  9, 3, CURRENT_DATE,                     '14:00', '22:00', 'confirmado',    FALSE),
  (13, 1, 1, CURRENT_DATE,                     '06:00', '14:00', 'confirmado',    FALSE),
  (14, 2, 2, CURRENT_DATE,                     '14:00', '22:00', 'confirmado',    FALSE),
  (15, 3, 3, CURRENT_DATE,                     '22:00', '06:00', 'confirmado',    FALSE),
  (16, 1, 1, CURRENT_DATE,                     '06:00', '14:00', 'confirmado',    FALSE);

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
   NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days' + INTERVAL '30 minutes', NOW() - INTERVAL '4 days' + INTERVAL '4 hours', 11);
SELECT setval('seq_incidencias', 6);

INSERT INTO criterios_mcda (id, codigo, nombre, descripcion, peso, activo) VALUES
  (1, 'C01', 'Cantidad de evidencias registradas',        'Volumen y cumplimiento de evidencias cargadas',            0.250, TRUE),
  (2, 'C02', 'Incidencias registradas',                  'Frecuencia y criticidad de incidencias ocurridas',         0.250, TRUE),
  (3, 'C03', 'Protocolos realizados',                    'Protocolos y actividades ejecutadas durante el servicio', 0.250, TRUE),
  (4, 'C04', 'Puntualidad y duración estimada del turno', 'Cumplimiento de horario y duración prevista',             0.250, TRUE);
SELECT setval('criterios_mcda_id_seq', 4);

INSERT INTO evaluaciones_multicriterio (id, servicio_id, fecha_evaluacion, puntaje_global, nivel) VALUES
  (1, 7,  NOW() - INTERVAL '1 hour', 36.00, 'alta'),
  (2, 9,  NOW() - INTERVAL '1 hour', 54.00, 'media'),
  (3, 10, NOW() - INTERVAL '1 hour', 55.00, 'media'),
  (4, 5,  NOW() - INTERVAL '1 hour', 68.00, 'media'),
  (5, 6,  NOW() - INTERVAL '1 hour', 75.00, 'baja'),
  (6, 2,  NOW() - INTERVAL '1 hour', 81.00, 'baja');
SELECT setval('evaluaciones_multicriterio_id_seq', 6);

INSERT INTO evaluacion_criterios (evaluacion_id, criterio_id, puntaje, influye) VALUES
  (1,1,35.00,TRUE), (1,2,10.00,TRUE), (1,3,0.00,TRUE),  (1,4,100.00,FALSE),
  (2,1,35.00,TRUE), (2,2,100.00,FALSE),(2,3,0.00,TRUE),  (2,4,80.00,FALSE),
  (3,1,20.00,TRUE), (3,2,100.00,FALSE),(3,3,0.00,TRUE),  (3,4,100.00,FALSE),
  (4,1,80.00,FALSE),(4,2,100.00,FALSE),(4,3,90.00,FALSE),(4,4,0.00,TRUE),
  (5,1,100.00,FALSE),(5,2,100.00,FALSE),(5,3,100.00,FALSE),(5,4,0.00,TRUE),
  (6,1,80.00,FALSE),(6,2,80.00,FALSE),(6,3,90.00,FALSE),(6,4,75.00,FALSE);

INSERT INTO reportes_generados (tipo, categoria, formato, estado, generado_por) VALUES
  ('servicios',     'operativos',    'xlsx', 'completado', 1),
  ('turnos',        'operativos',    'pdf',  'completado', 1),
  ('incidencias',   'incidencias',   'xlsx', 'completado', 1),
  ('multicriterio', 'multicriterio', 'xlsx', 'completado', 1);

INSERT INTO actividad_reciente (tipo, descripcion, usuario_id, creado_en) VALUES
  ('incidencia_registrada', 'Incidencia INC-0005 registrada en Vigilancia principal', 1, NOW() - INTERVAL '1 hour'),
  ('servicio_iniciado',     'Servicio Vigilancia principal iniciado',                  1, NOW() - INTERVAL '2 hours'),
  ('turno_asignado',        'Turno asignado a María Torres para hoy',                  1, NOW() - INTERVAL '3 hours'),
  ('incidencia_atendida',   'Incidencia INC-0004 en atención por equipo técnico',      2, NOW() - INTERVAL '4 hours');

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

INSERT INTO evidencias_servicio (servicio_id, protocolo_id, personal_id, titulo, descripcion, archivo_url, estado_revision, observacion, revisado_por, fecha_revision) VALUES
  (6, 1, 3, 'Registro de visita transportista', 'Se validó guía de remisión N° 45812 y DNI de conductor en puerta 1', 'https://ik.imagekit.io/segurtrack/evidencias/guia_45812.jpg', 'aprobada', 'Registro completo con datos verificados', 2, NOW() - INTERVAL '3 hours'),
  (6, 2, 4, 'Ronda perimetral este', 'Puerta posterior de emergencia encontrada asegurada correctamente', 'https://ik.imagekit.io/segurtrack/evidencias/ronda_este.jpg', 'aprobada', 'Conforme sin novedades', 2, NOW() - INTERVAL '2 hours'),
  (10, 3, 3, 'Falsa alarma sensor de movimiento', 'Causada por ráfaga de viento en almacén 3. Se descartó intrusión.', 'https://ik.imagekit.io/segurtrack/evidencias/alarma_sensor.jpg', 'observada', 'Se requiere reubicar sensor hacia zona interna', 2, NOW() - INTERVAL '1 hour'),
  (8, 2, 5, 'Ronda sector estacionamientos', 'Inspección de vehículos estacionados y luminarias', 'https://ik.imagekit.io/segurtrack/evidencias/estacionamiento.jpg', 'pendiente', NULL, NULL, NULL);


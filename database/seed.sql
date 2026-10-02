INSERT INTO usuarios (nombre, correo, clave_hash, rol) VALUES
  ('Administrador Sistema', 'admin@segurtrack.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'administrador'),
  ('María Torres', 'mtorres@segurtrack.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'supervisor'),
  ('Juan López', 'jlopez@segurtrack.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'operador'),
  ('Carla Gómez', 'cgomez@segurtrack.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'supervisor'),
  ('Miguel Sánchez', 'msanchez@segurtrack.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'supervisor'),
  ('Laura Gómez', 'lgomez@segurtrack.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'supervisor');

INSERT INTO sedes (nombre, direccion) VALUES
  ('Centro Logístico Norte', 'Av. Industrial 1200, Zona Norte'),
  ('Oficinas Corporativas', 'Jr. Los Álamos 450, San Isidro'),
  ('Planta Sur', 'Carretera Panamericana Sur Km 23');

INSERT INTO clientes (nombre, contacto) VALUES
  ('Centro Logístico', 'contacto@centrologistico.com'),
  ('Torres Corp.', 'gerencia@torrescorp.com'),
  ('Parque Industrial', 'admin@parqueindustrial.com'),
  ('Grupo Andino', 'operaciones@grupoandino.com'),
  ('LogiTrans', 'logistica@logitrans.com');

INSERT INTO personal (nombres, apellidos, documento, cargo, estado, sede_id) VALUES
  ('María',  'Torres',    '32456789', 'supervisor',    'activo',   1),
  ('Juan',   'López',     '28341776', 'agente',        'activo',   1),
  ('Carla',  'Álvarez',   '41987653', 'agente',        'activo',   2),
  ('Diego',  'Rojas',     '37112445', 'agente',        'activo',   1),
  ('Lucía',  'Sánchez',   '29667221', 'administrativo','inactivo', 2),
  ('Pablo',  'Contreras', '36554998', 'agente',        'activo',   3),
  ('Carla',  'Ruiz',      '40123456', 'agente',        'activo',   1),
  ('Ana',    'Pérez',     '35678901', 'agente',        'activo',   2),
  ('Luis',   'García',    '42345678', 'agente',        'activo',   3),
  ('Carla',  'Gómez',     '38901234', 'supervisor',    'activo',   3),
  ('Miguel', 'Sánchez',   '31234567', 'supervisor',    'activo',   2),
  ('Laura',  'Gómez',     '39012345', 'supervisor',    'activo',   1),
  ('Roberto','Mendoza',   '44567890', 'agente',        'activo',   1),
  ('Elena',  'Castro',    '33456789', 'agente',        'activo',   2),
  ('Fernando','Quispe',   '45678901', 'agente',        'activo',   3),
  ('Patricia','Flores',   '34567890', 'agente',        'activo',   1),
  ('Carlos', 'Vega',      '46789012', 'agente',        'activo',   2),
  ('Andrea', 'Morales',   '35678902', 'agente',        'activo',   3),
  ('José',   'Herrera',   '47890123', 'supervisor',    'activo',   1),
  ('Sofia',  'Reyes',     '36789012', 'agente',        'activo',   2);

INSERT INTO servicios (nombre, cliente_id, sede_id, supervisor_id, hora_inicio, hora_fin, estado, fecha_inicio, fecha_fin) VALUES
  ('Vigilancia principal',  1, 1, 1,  '06:00', '14:00', 'en_curso',   '2025-04-01', NULL),
  ('Control de accesos',    2, 2, 11, '14:00', '22:00', 'programado', '2025-04-01', NULL),
  ('Ronda perimetral',      3, 3, 10, '22:00', '06:00', 'en_curso',   '2025-04-01', NULL),
  ('Recepción',             4, 2, 11, '08:00', '16:00', 'programado', '2025-04-01', NULL),
  ('Monitoreo CCTV',        5, 1, 12, '00:00', '24:00', 'finalizado', '2025-03-01', '2025-03-31'),
  ('Acceso Norte',          1, 1, 1,  '06:00', '14:00', 'en_curso',   '2025-04-01', NULL),
  ('Vigilancia Exteriores', 3, 3, 10, '14:00', '22:00', 'en_curso',   '2025-04-01', NULL),
  ('Control de Accesos 2',  2, 2, 11, '22:00', '06:00', 'en_curso',   '2025-04-01', NULL),
  ('Rondas Nocturnas',      4, 3, 10, '22:00', '06:00', 'en_curso',   '2025-04-01', NULL),
  ('Recepción Principal',   5, 2, 11, '08:00', '16:00', 'programado', '2025-04-01', NULL);

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
  (1,  1, 1, '2025-05-26', '06:00', '14:00', 'confirmado',    FALSE),
  (1,  1, 1, '2025-05-27', '06:00', '14:00', 'sin_confirmar', FALSE),
  (1,  1, 1, '2025-05-28', '06:00', '14:00', 'sin_confirmar', FALSE),
  (1,  1, 1, '2025-05-29', '06:00', '14:00', 'confirmado',    FALSE),
  (1,  1, 1, '2025-05-30', '06:00', '14:00', 'confirmado',    FALSE),
  (1,  1, 1, '2025-06-01', '06:00', '14:00', 'confirmado',    FALSE),
  (2,  1, 1, '2025-05-26', '14:00', '22:00', 'confirmado',    FALSE),
  (2,  1, 1, '2025-05-27', '14:00', '22:00', 'confirmado',    FALSE),
  (2,  1, 1, '2025-05-28', '14:00', '22:00', 'confirmado',    FALSE),
  (2,  1, 1, '2025-05-29', '14:00', '22:00', 'confirmado',    FALSE),
  (2,  1, 1, '2025-05-31', '14:00', '22:00', 'confirmado',    TRUE),
  (2,  1, 1, '2025-06-01', '14:00', '22:00', 'confirmado',    FALSE),
  (7,  3, 1, '2025-05-26', '22:00', '06:00', 'confirmado',    FALSE),
  (7,  3, 1, '2025-05-27', '22:00', '06:00', 'confirmado',    FALSE),
  (7,  3, 1, '2025-05-28', '22:00', '06:00', 'confirmado',    FALSE),
  (7,  3, 1, '2025-05-30', '22:00', '06:00', 'confirmado',    FALSE),
  (7,  3, 1, '2025-05-31', '22:00', '06:00', 'confirmado',    FALSE),
  (7,  3, 1, '2025-06-01', '22:00', '06:00', 'confirmado',    FALSE),
  (8,  2, 2, '2025-05-26', '06:00', '14:00', 'confirmado',    FALSE),
  (8,  2, 2, '2025-05-27', '06:00', '14:00', 'confirmado',    FALSE),
  (8,  2, 2, '2025-05-29', '06:00', '14:00', 'confirmado',    FALSE),
  (8,  2, 2, '2025-05-30', '06:00', '14:00', 'confirmado',    FALSE),
  (8,  2, 2, '2025-05-31', '06:00', '14:00', 'confirmado',    FALSE),
  (8,  2, 2, '2025-06-01', '06:00', '14:00', 'confirmado',    FALSE),
  (9,  9, 3, '2025-05-26', '14:00', '22:00', 'confirmado',    FALSE),
  (9,  9, 3, '2025-05-28', '14:00', '22:00', 'confirmado',    FALSE),
  (9,  9, 3, '2025-05-29', '14:00', '22:00', 'confirmado',    FALSE),
  (9,  9, 3, '2025-05-30', '14:00', '22:00', 'confirmado',    FALSE),
  (9,  9, 3, '2025-05-31', '14:00', '22:00', 'confirmado',    FALSE),
  (2,  1, 1, '2025-04-15', '06:00', '14:00', 'cumplido',      FALSE),
  (7,  3, 1, '2025-04-16', '22:00', '06:00', 'cumplido',      FALSE),
  (8,  2, 2, '2025-04-17', '06:00', '14:00', 'cumplido',      FALSE),
  (9,  9, 3, '2025-04-18', '14:00', '22:00', 'cumplido',      FALSE),
  (13, 1, 1, '2025-04-19', '06:00', '14:00', 'pendiente',     FALSE),
  (14, 2, 2, '2025-04-20', '14:00', '22:00', 'pendiente',     FALSE),
  (15, 3, 3, '2025-04-21', '22:00', '06:00', 'pendiente',     FALSE),
  (16, 1, 1, '2025-04-22', '06:00', '14:00', 'cumplido',      FALSE),
  (17, 2, 2, '2025-04-23', '14:00', '22:00', 'cumplido',      FALSE),
  (18, 9, 3, '2025-04-24', '22:00', '06:00', 'cumplido',      FALSE),
  (19, 1, 1, '2025-04-25', '06:00', '14:00', 'cumplido',      FALSE),
  (20, 2, 2, '2025-04-26', '14:00', '22:00', 'cumplido',      FALSE),
  (3,  6, 1, '2025-04-10', '06:00', '14:00', 'cumplido',      FALSE),
  (4,  7, 3, '2025-04-11', '14:00', '22:00', 'cumplido',      FALSE);

INSERT INTO tipos_incidencia (nombre) VALUES
  ('Acceso no autorizado'),
  ('Falla de equipo'),
  ('Evento de seguridad'),
  ('Conducta inadecuada'),
  ('Alarma activada'),
  ('Incumplimiento de turno'),
  ('Otros');

INSERT INTO incidencias (codigo, tipo_incidencia_id, servicio_id, descripcion, prioridad, estado, fecha_registro, fecha_atencion, fecha_cierre, registrado_por) VALUES
  ('INC-0041', 6, 2, 'Agente no se presentó a su turno asignado en Oficinas Corp.', 'media', 'cerrada',
   '2025-04-23 18:20:00', '2025-04-23 19:00:00', '2025-04-23 21:00:00', 1),
  ('INC-0042', 5, 1, 'Activación de alarma perimetral en zona norte sin causa aparente.', 'alta', 'en_atencion',
   '2025-04-23 21:36:00', '2025-04-23 22:10:00', NULL, 1),
  ('INC-0043', 4, 3, 'Reporte de conducta inadecuada de personal en turno nocturno.', 'baja', 'cerrada',
   '2025-04-24 12:07:00', '2025-04-24 12:30:00', '2025-04-24 15:00:00', 2),
  ('INC-0044', 2, 2, 'Falla en sistema de control de accesos. Torniquete bloqueado.', 'media', 'en_atencion',
   '2025-04-24 14:18:00', '2025-04-24 14:45:00', NULL, 1),
  ('INC-0045', 1, 1, 'Persona no autorizada detectada en zona de carga del almacén.', 'alta', 'abierta',
   '2025-04-24 15:42:00', NULL, NULL, 1),
  ('INC-0040', 3, 3, 'Evento de seguridad reportado en acceso principal de planta.', 'alta', 'cerrada',
   '2025-04-22 10:00:00', '2025-04-22 10:30:00', '2025-04-22 14:00:00', 1),
  ('INC-0039', 1, 6, 'Acceso no autorizado en zona de servidores.', 'alta', 'cerrada',
   '2025-04-21 08:15:00', '2025-04-21 08:40:00', '2025-04-21 12:00:00', 2),
  ('INC-0038', 2, 7, 'Cámara de seguridad exterior sin señal.', 'media', 'cerrada',
   '2025-04-20 16:30:00', '2025-04-20 17:00:00', '2025-04-20 20:00:00', 1),
  ('INC-0037', 6, 9, 'Agente no se presentó al inicio de turno nocturno.', 'alta', 'cerrada',
   '2025-04-19 22:05:00', '2025-04-19 22:20:00', '2025-04-19 23:45:00', 1),
  ('INC-0036', 4, 4, 'Reporte de comportamiento inapropiado en recepción.', 'baja', 'abierta',
   '2025-04-18 14:00:00', NULL, NULL, 2),
  ('INC-0035', 5, 1, 'Alarma activada en almacén principal.', 'alta', 'cerrada',
   '2025-04-17 11:00:00', '2025-04-17 11:15:00', '2025-04-17 13:00:00', 1),
  ('INC-0034', 7, 8, 'Reporte de anomalía en ronda nocturna.', 'media', 'cerrada',
   '2025-04-16 02:00:00', '2025-04-16 02:30:00', '2025-04-16 06:00:00', 1),
  ('INC-0033', 1, 6, 'Intento de ingreso con credenciales falsas.', 'alta', 'cerrada',
   '2025-04-15 10:00:00', '2025-04-15 10:20:00', '2025-04-15 14:00:00', 1),
  ('INC-0032', 2, 2, 'Falla en sistema de videosurveillance. Monitor apagado.', 'media', 'cerrada',
   '2025-04-14 09:00:00', '2025-04-14 09:30:00', '2025-04-14 12:00:00', 2),
  ('INC-0031', 3, 3, 'Incidente de seguridad en perímetro exterior.', 'alta', 'cerrada',
   '2025-04-13 20:00:00', '2025-04-13 20:15:00', '2025-04-13 23:00:00', 1),
  ('INC-0030', 6, 9, 'Turno sin cobertura por inasistencia de agente.', 'media', 'abierta',
   '2025-04-12 06:10:00', NULL, NULL, 1);

SELECT setval('seq_incidencias', 45);

INSERT INTO criterios_mcda (codigo, nombre, descripcion, peso, activo) VALUES
  ('C01', 'Cumplimiento de turnos',    'Cobertura y asistencia del personal en turnos programados', 0.200, TRUE),
  ('C02', 'Cumplimiento de servicios', 'Ejecución de servicios según planificación establecida',    0.200, TRUE),
  ('C03', 'Incidencias abiertas',      'Número y criticidad de incidencias sin resolver',           0.200, TRUE),
  ('C04', 'Tiempo de atención',        'Rapidez de respuesta ante incidencias reportadas',          0.200, TRUE),
  ('C05', 'Resolución de incidencias', 'Porcentaje de incidencias resueltas sobre el total',        0.200, TRUE);

INSERT INTO evaluaciones_multicriterio (servicio_id, fecha_evaluacion, puntaje_global, nivel) VALUES
  (10, NOW() - INTERVAL '1 day', 43.00, 'alta'),
  (6,  NOW() - INTERVAL '1 day', 67.00, 'media'),
  (7,  NOW() - INTERVAL '1 day', 78.00, 'baja'),
  (8,  NOW() - INTERVAL '1 day', 52.00, 'media'),
  (9,  NOW() - INTERVAL '1 day', 61.00, 'media');

INSERT INTO evaluacion_criterios (evaluacion_id, criterio_id, puntaje, influye) VALUES
  (1,1,30.00,TRUE),(1,2,70.00,FALSE),(1,3,20.00,TRUE),(1,4,45.00,TRUE),(1,5,50.00,FALSE),
  (2,1,75.00,FALSE),(2,2,55.00,TRUE),(2,3,80.00,FALSE),(2,4,60.00,FALSE),(2,5,55.00,TRUE),
  (3,1,80.00,FALSE),(3,2,75.00,FALSE),(3,3,85.00,FALSE),(3,4,72.00,FALSE),(3,5,78.00,FALSE),
  (4,1,55.00,TRUE),(4,2,58.00,TRUE),(4,3,50.00,TRUE),(4,4,48.00,FALSE),(4,5,52.00,FALSE),
  (5,1,58.00,TRUE),(5,2,65.00,FALSE),(5,3,65.00,FALSE),(5,4,55.00,TRUE),(5,5,62.00,FALSE);

INSERT INTO reportes_generados (tipo, categoria, formato, estado, generado_por) VALUES
  ('servicios',     'operativos',    'xlsx', 'completado', 1),
  ('turnos',        'operativos',    'pdf',  'completado', 1),
  ('multicriterio', 'multicriterio', 'xlsx', 'completado', 1);

INSERT INTO actividad_reciente (tipo, descripcion, usuario_id, creado_en) VALUES
  ('incidencia_registrada', 'Incidencia INC-0045 registrada en Vigilancia principal', 1, NOW() - INTERVAL '2 hours 18 minutes'),
  ('servicio_iniciado',     'Servicio Vigilancia principal iniciado',                  1, NOW() - INTERVAL '2 hours 42 minutes'),
  ('turno_asignado',        'Turno asignado a María Torres para el miércoles',         1, NOW() - INTERVAL '3 hours 5 minutes'),
  ('incidencia_atendida',   'Incidencia INC-0044 en atención por equipo técnico',      2, NOW() - INTERVAL '3 hours 15 minutes'),
  ('personal_creado',       'Nuevo agente Fernando Quispe agregado al sistema',        1, NOW() - INTERVAL '5 hours');

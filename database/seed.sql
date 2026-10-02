-- ============================================================================
-- CREDENCIALES DE ACCESO POR ROL:
-- 1. Rol Administrador:
--    Correo: admin@segurtrack.com
--    Contraseña: Admin1234
-- 2. Rol Supervisor (ejemplos):
--    Correo: mtorres@segurtrack.com  | Contraseña por defecto: mtorres@segurtrack.com
--    Correo: cgomez@segurtrack.com   | Contraseña por defecto: cgomez@segurtrack.com
--    Correo: msanchez@segurtrack.com | Contraseña por defecto: msanchez@segurtrack.com
--    Correo: lgomez@segurtrack.com   | Contraseña por defecto: lgomez@segurtrack.com
--    Correo: jherrera@segurtrack.com | Contraseña por defecto: jherrera@segurtrack.com
-- 3. Rol Operador (Agentes de Seguridad, ejemplos):
--    Correo: jlopez@segurtrack.com   | Contraseña por defecto: jlopez@segurtrack.com
--    Correo: calvarez@segurtrack.com | Contraseña por defecto: calvarez@segurtrack.com
--    Correo: drojas@segurtrack.com   | Contraseña por defecto: drojas@segurtrack.com
--    Correo: pcontreras@segurtrack.com | Contraseña por defecto: pcontreras@segurtrack.com
--    Nota: Al iniciar sesión con contraseña por defecto se solicita el cambio inmediato.
-- ============================================================================

TRUNCATE TABLE
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
(1, 'Administrador Sistema', 'admin@segurtrack.com', '$2a$10$dMbbbbey.8AVCPm5A4ZUR.XeC/9nbbESSL6zBOBTirOw1YpOZ7Sbi', 'administrador', TRUE, FALSE),
(2, 'María Torres', 'mtorres@segurtrack.com', '$2a$10$TX352lT05zdL3dd1Fz.O3OILvw72nP8ffWMtDkq6CWBuAkJTH4N.6', 'supervisor', TRUE, TRUE),
(3, 'Juan López', 'jlopez@segurtrack.com', '$2a$10$ljNLoP3gyxlUUC9.c2w74e4baalGiVUxchBZrc6yH4Y8LnoHfEoZ6', 'operador', TRUE, TRUE),
(4, 'Carla Álvarez', 'calvarez@segurtrack.com', '$2a$10$JXcTwrXVVWFB8qqAWLRKPuha5dnwjyu2jQdZkvoPwYGXc/OPx0LES', 'operador', TRUE, TRUE),
(5, 'Diego Rojas', 'drojas@segurtrack.com', '$2a$10$aXGHTP/JLRWdPdZkoVVyNu9pWDL1pzTv1EaoqhtlI6PBD554ULSSS', 'operador', TRUE, TRUE),
(6, 'Lucía Sánchez', 'lsanchez@segurtrack.com', '$2a$10$H119zhSBsIjMmCpDURyFtOltyU3EKNsg2lnNyiw.x0eBS11WumYIK', 'operador', FALSE, TRUE),
(7, 'Pablo Contreras', 'pcontreras@segurtrack.com', '$2a$10$lj/Um3mS72pi8dqSe65EQ.rh3U6f8Oy9HT5BcHDlCfi6y/ciDRCKa', 'operador', TRUE, TRUE),
(8, 'Carla Ruiz', 'cruiz@segurtrack.com', '$2a$10$w8874NeCWqtDqzUhKh9F6eH9dn/Z9jGwkhbrKHgtrZOXdz10Kajqe', 'operador', TRUE, TRUE),
(9, 'Ana Pérez', 'aperez@segurtrack.com', '$2a$10$.WtCU/KDplFkLJXW9qhsIuElnd7hXeOqqOG5gBLgu9ThdDR0LhqyG', 'operador', TRUE, TRUE),
(10, 'Luis García', 'lgarcia@segurtrack.com', '$2a$10$dbUoWpFjoktoUoEQa2PLp.PaIdhPfFQxdplxnipijHBgc.YHTLq2i', 'operador', TRUE, TRUE),
(11, 'Carla Gómez', 'cgomez@segurtrack.com', '$2a$10$PBBsISlrz/iQWFJIbtPOwOGu3mX7ED3bM/SZNNM015qdZRYem/Qra', 'supervisor', TRUE, TRUE),
(12, 'Miguel Sánchez', 'msanchez@segurtrack.com', '$2a$10$rZkrTH/6F5ooWbUQOSMNMOt2UDGRLkJ5gnji8C9ToBBlB4l.wA0pG', 'supervisor', TRUE, TRUE),
(13, 'Laura Gómez', 'lgomez@segurtrack.com', '$2a$10$QcrOsoflUqRhIpYrMqhv6u8ZfzX90JZRT5Ut/pYOUHF0U75N7tKSG', 'supervisor', TRUE, TRUE),
(14, 'Roberto Mendoza', 'rmendoza@segurtrack.com', '$2a$10$Ztsr58vrUDnJAt7XnTbgE.cRs42ck1zajeCGSjpN/dyvNJIO4Qzhu', 'operador', TRUE, TRUE),
(15, 'Elena Castro', 'ecastro@segurtrack.com', '$2a$10$rGgsKrNLiL8KxSMjTRYpB.XS9Iqyr99.09WbtlW1RER.hLuBiJYM.', 'operador', TRUE, TRUE),
(16, 'Fernando Quispe', 'fquispe@segurtrack.com', '$2a$10$RmUkFFv92pb3DFEBE.1uXuHpT6wla51VfV8H337D/odq4rxEb1fBy', 'operador', TRUE, TRUE),
(17, 'Patricia Flores', 'pflores@segurtrack.com', '$2a$10$NpEbhAQzAQVgCZQORXZxVeV3TMhB1X0bBfoguieDi59SOUC/LRAum', 'operador', TRUE, TRUE),
(18, 'Carlos Vega', 'cvega@segurtrack.com', '$2a$10$g2k2M4eLAzUrDPbJJQG2N.OsXYLgCp1Ne.6dxTCIu82EFuhWPFimu', 'operador', TRUE, TRUE),
(19, 'Andrea Morales', 'amorales@segurtrack.com', '$2a$10$MnJlhaoLf8A/wk/ZI1m00eaQuMGn20weBcWL4ywzixE5ADDvUwWo.', 'operador', TRUE, TRUE),
(20, 'José Herrera', 'jherrera@segurtrack.com', '$2a$10$PwLs1mI/cfdneZz21VkqyemgJr8tcmmt1gIyt.N68Wla0O5bz9p0e', 'supervisor', TRUE, TRUE),
(21, 'Sofia Reyes', 'sreyes@segurtrack.com', '$2a$10$K5cuvQRpaCIfRwk/rHwHNOjY4Kp5WLSY.9aCxA9Bl0ixTZzC4YGXm', 'operador', TRUE, TRUE);
SELECT setval('usuarios_id_seq', 21);

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
(20, 'Sofia', 'Reyes', '36789012', 'agente', 'activo', 'sreyes@segurtrack.com', 2, 21);
SELECT setval('personal_id_seq', 20);

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
  (1, 'C01', 'Cumplimiento de turnos',    'Cobertura y asistencia del personal en turnos programados', 0.200, TRUE),
  (2, 'C02', 'Cumplimiento de servicios', 'Ejecución de servicios según planificación establecida',    0.200, TRUE),
  (3, 'C03', 'Incidencias abiertas',      'Número y criticidad de incidencias sin resolver',           0.200, TRUE),
  (4, 'C04', 'Tiempo de atención',        'Rapidez de respuesta ante incidencias reportadas',          0.200, TRUE),
  (5, 'C05', 'Resolución de incidencias', 'Porcentaje de incidencias resueltas sobre el total',        0.200, TRUE);
SELECT setval('criterios_mcda_id_seq', 5);

INSERT INTO evaluaciones_multicriterio (id, servicio_id, fecha_evaluacion, puntaje_global, nivel) VALUES
  (1, 10, NOW() - INTERVAL '1 day', 43.00, 'alta'),
  (2, 6,  NOW() - INTERVAL '1 day', 67.00, 'media'),
  (3, 7,  NOW() - INTERVAL '1 day', 78.00, 'baja'),
  (4, 8,  NOW() - INTERVAL '1 day', 52.00, 'media'),
  (5, 9,  NOW() - INTERVAL '1 day', 61.00, 'media');
SELECT setval('evaluaciones_multicriterio_id_seq', 5);

INSERT INTO evaluacion_criterios (evaluacion_id, criterio_id, puntaje, influye) VALUES
  (1,1,30.00,TRUE),(1,2,70.00,FALSE),(1,3,20.00,TRUE),(1,4,45.00,TRUE),(1,5,50.00,FALSE),
  (2,1,75.00,FALSE),(2,2,55.00,TRUE),(2,3,80.00,FALSE),(2,4,60.00,FALSE),(2,5,55.00,TRUE),
  (3,1,80.00,FALSE),(3,2,75.00,FALSE),(3,3,85.00,FALSE),(3,4,72.00,FALSE),(3,5,78.00,FALSE),
  (4,1,55.00,TRUE),(4,2,58.00,TRUE),(4,3,50.00,TRUE),(4,4,48.00,FALSE),(4,5,52.00,FALSE),
  (5,1,58.00,TRUE),(5,2,65.00,FALSE),(5,3,65.00,FALSE),(5,4,55.00,TRUE),(5,5,62.00,FALSE);

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

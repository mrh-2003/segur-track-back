# Correcciones operativas

Se aplicó la migración `006_horario_personal.sql`: horarios y días laborales opcionales por persona e índices de consultas operativas.

- **Monitores:** cada fuente se agrega independientemente antes de combinar resultados. Los meses de turnos y de incidencias se calculan por su propia fecha. `periodos` se interpreta como meses en Histórico.
- **Programación:** el selector consulta `/operaciones/opciones-turno`. Solo ofrece personal vinculado al servicio, activo, dentro de su jornada y sin cruces con turnos o ausencias. La misma validación se ejecuta al guardar. Las plazas sin asignar siguen disponibles.
- **Horario habitual:** se configura en Personal → Editar → Horario laboral. Sin horas, la jornada es flexible en los días seleccionados. Las jornadas nocturnas pertenecen al día de inicio. Los registros existentes conservan disponibilidad flexible; no se dedujo un horario contractual a partir de datos de prueba.
- **Flujo de turno:** confirmar → ingreso → preparar fotografías → salida → finalizar. El modal mantiene el avance y las fotografías seleccionadas después de marcar salida. Las acciones alternativas, la supervisión y la trazabilidad están agrupadas en desplegables.
- **Salida pendiente:** validar un ingreso no impide completar una salida todavía vacía. La nueva marcación deja la asistencia pendiente de revisión y genera historial. Las marcaciones ya registradas se corrigen mediante supervisión con motivo.
- **Evidencias:** las fotografías nuevas requieren HTTPS. Las rutas locales de evidencia sintética previamente registradas se conservan únicamente cuando el entorno está marcado como demo. No se admite enviar rutas locales arbitrarias. La firma de carga a ImageKit se solicita al servidor.
- **Inicio:** importación con selector diseñado y arrastre de archivo; disponibilidad y ausencias comparten panel, pestañas, búsqueda y rango horario.
- **BI:** un indicador ausente muestra `—`; un cero válido conserva su valor y unidad.
- **Oscuro:** los iconos de acciones de tablas usan blanco; los controles nativos respetan el tema oscuro.

## Guardar evaluación

Guarda una instantánea por servicio en `evaluaciones_operativas`: usuario, fecha de creación, versión del modelo, filtros y resultado (criterios, pesos, tasas, riesgos y aportes). Permite conservar el cálculo para auditoría cuando cambian los datos o el modelo. También refresca las tablas analíticas. No modifica turnos ni incidencias.

El monitor sigue consultando los datos actuales y Análisis Histórico se calcula desde los registros operativos; no se reemplaza por esas instantáneas. Actualmente no hay una pantalla para consultar las evaluaciones guardadas.

## Verificación

`npm test` cubre criterios y jornadas diurnas/nocturnas. `npm run test:integration` verifica conteos de monitores, meses, compatibilidad, cruces, salida pendiente validada, evidencias y reglas operativas en una transacción con rollback. La revisión en Edge comprueba ambas direcciones del filtrado, Inicio, BI sin valores nulos, modo oscuro y ausencia de desbordamiento móvil.

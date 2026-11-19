# Resumen de la integración operativa — 18/11/2026

| Módulo | Cambio |
|---|---|
| Servicios | Pestaña Plan operativo: actividades, rondas recurrentes, reportes y catálogo de consignas; confirmación y programación de turnos futuros. |
| Turnos | Generación automática de obligaciones al crear/importar; ejecución por agente; contenido del reporte, carga de imágenes con vista previa y verificación de consignas; corrección histórica por supervisión. |
| Incidencias | Plazos de atención y resolución separados en formulario y tabla; asignación automática de plazos por prioridad al crear o actualizar un caso sin ellos. |
| Monitor multicriterio | Los diez KPI consumen la ejecución real; acceso rápido compartido con Turnos y distinción entre Sin casos y Faltan datos. |
| API / permisos | Planes editables por supervisión; agentes limitados a ejecutar sus turnos; rechazo de entregas sin contenido, duplicados y fechas inválidas. |
| Base / instalación | Migraciones 009 y 010; complemento aditivo de datos demo; SQL completos, generadores y verificación de restauración actualizados. |

| Tabla | Cambio |
|---|---|
| planes_operativos (nueva) | Confirmación y responsable del plan por servicio. |
| plantillas_operativas (nueva) | Tipo, descripción, plazo desde el inicio, intervalo y vigencia. |
| obligaciones_operativas | Relación con plantilla y secuencia, contenido del resultado/reporte, colección de imágenes y origen del registro. |
| rondas | Relación con plantilla y secuencia, usuario que completó la ronda, imágenes y origen. |
| incidencias | Origen del plazo y disparador que completa los plazos faltantes al crear o modificar casos; datos demo complementados. |
| turnos | Disparador que genera la programación desde el plan; confirmación automática de su inventario. |
| consignas | Catálogo administrable desde el plan del servicio y datos de prueba. |
| verificaciones_consignas | Captura desde Turnos, comprobación de pertenencia y prevención de verificación repetida. |
| evaluaciones_operativas | Instantáneas de resultados de la muestra, disponibles para BI. |

Se conservan los registros anteriores. Las tablas de auditoría y los hechos de BI se actualizan a partir de las operaciones y del refresco analítico. Los pesos y fórmulas del modelo operativo-v4 se mantienen.

Las pruebas cubren cálculo de diez KPI, 12 filtros de periodo/franja, plan automático, nocturnos, idempotencia, permisos, entregas con contenido, consignas, importación, API y pantallas. Los SQL completos y la instalación modular se prueban en PostgreSQL temporal independiente.

El informe de cantidades y resultados por servicio está en [datos-prueba-kpis-2026-11-18.json](../../analisis/datos-prueba-kpis-2026-11-18.json).

Corrección adicional: bloqueo visible de ejecuciones de turnos futuros, validación con reloj de PostgreSQL, carga de imágenes en las tres clases de obligación y contraste de botones en modo oscuro.

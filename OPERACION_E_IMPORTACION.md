# Operación evaluable e importación de tareaje

## Cambios implementados

Turnos tiene calendario con varios turnos diarios, vista de tabla, filtro por estado, puesto/agencia, plazas sin asignar, marcación de ingreso/salida, validación de asistencia, obligaciones de evidencia y reasignación con motivo e historial. Una plaza sin asignar representa demanda real, sin una persona ficticia. Los solapamientos se comprueban con fecha y hora completas, incluyendo medianoche y ausencias registradas.

Incidencias distingue registrador, responsable de atención y persona vinculada. Conserva historial de cambios, primera atención y plazo de atención. El total de las tarjetas respeta los filtros. Los nuevos registros usan plazos iniciales de 60, 240 y 1440 minutos para prioridad alta, media y baja; cada incidencia permite definir otro plazo.

Inicio muestra agentes disponibles para una franja y permite registrar descansos, vacaciones, licencias u otras ausencias. Administradores y jefes de operaciones pueden descargar la plantilla e importar desde esa página.

El monitor tiene filtros por 3, 7, 30 días o todo el histórico, servicios y turno diurno/nocturno/ambos. Incluye Prioridades, Matriz, Evolución y Método y validación, detalle, explicación del cálculo, incidencias críticas y ayuda. Los pesos y umbrales pueden configurarse; guardar evaluación conserva una instantánea de filtros y datos utilizados.

## Los cinco criterios

| Criterio | Fuente y regla |
|---|---|
| Cumplimiento de turnos | Plazas-turno vencidas con asistencia validada, ingreso, salida al término previsto y estado cumplido / plazas-turno vencidas |
| Puntualidad | Ingresos dentro de la tolerancia / presencias verificadas |
| Cobertura | Plazas con presencia validada / plazas requeridas cuyo inicio ya ocurrió |
| Registro de evidencias | Cantidad registrada dentro del plazo, limitada a la obligación / cantidad exigible |
| Atención oportuna | Incidencias atendidas dentro del SLA / incidencias atendidas o con plazo vencido |

La tolerancia inicial de cada turno es 10 minutos. La franja diurna se determina por inicio entre 06:00 y 17:59; la nocturna es el resto. Todo se interpreta en America/Lima. Las incidencias sin turno vinculado utilizan su hora de registro para clasificar la franja.

Los cinco criterios están implementados, pero eso no completa hechos históricos desconocidos. Para evaluar un turno antiguo hay que registrar y validar su asistencia y sus obligaciones reales desde Turnos. Para evaluar incidencias antiguas sin plazo o responsable se deben completar esos campos. El sistema no sustituye datos faltantes por resultados saludables.

Cuando una fuente está completa y no existen obligaciones o casos aplicables, el criterio aporta riesgo cero y se identifica como Sin casos. Un servicio sin programación se identifica como incompleto. Una evaluación incompleta no recibe puntaje global ni redistribuye los pesos.

Las fotografías del cierre actualizan los registros del turno. Al registrar evidencia desde Servicios se puede seleccionar el turno asociado; esa evidencia participa en el criterio con su fecha real de registro. Los contadores históricos introducidos manualmente o importados requieren verificación de supervisión y quedan trazados. No se generan fotografías ficticias. Si existen registros de ambas fuentes, se usa el mayor conteo verificable, sin sumarlos para duplicar una misma obligación.

## Archivo de importación

Descargar **Inicio → Importar tareaje desde Excel → Descargar plantilla e instrucciones**. La plantilla contiene las hojas Tareaje e Instrucciones. Se acepta también SEPTIEMBRE como nombre de hoja. Límite: XLSX de 8 MB, 10.000 filas de datos y 100 columnas.

La unidad de cada fila es **una plaza-turno de un servicio**. Conductor y cabinero de una misma custodia repiten Codigo servicio y tienen Codigo turno distinto. Los códigos son referencias de negocio elegidas por quien prepara el archivo; no son los IDs internos de PostgreSQL.

### Columnas originales conservadas

Empresa; Cliente/Almacen; Solicitante; ORDEN/ SLP/ TGL/ CODIGO; Placa de Resguardo; RESGUARDO; MODALIDAD DE RESGUARDO; Transporte; Placa Custodiada; Contenedor; Fecha; Hra. De Solicitud Efectivo Policial; Hra. De instalacion; Hra. De Inicio; Fecha de llagada; Hra. Llegada; H. Term.; TOTAL HRS. TRABAJADAS; PUNTO INICIO; PUNTO FINAL; Observacion.

Empresa se interpreta como contratante: MAERSK en el ejemplo aclarado. Cliente/Almacen se conserva como entidad atendida o almacén, sin crear automáticamente otro contratante. Los hitos originales y sus observaciones se guardan como fuente. Los ajustes comerciales escritos en Observacion no modifican las marcaciones reales.

Transportistas, ubicaciones, vehículos y contenedores se guardan en catálogos relacionados. Múltiples placas o contenedores deben separarse con `;`, `//` o salto de línea. Se conserva el texto original para resolver casos ambiguos.

### Columnas adicionales

| Columna | Requisito |
|---|---|
| Codigo servicio | Obligatorio; identifica la custodia/servicio y se repite en sus participantes |
| Codigo turno | Obligatorio, único; identifica una plaza-turno y evita duplicación entre archivos |
| DNI | Ocho dígitos para una plaza asignada; vacío si Estado turno es sin_asignar |
| Nombres | Obligatorio si el DNI todavía no existe en Personal |
| Apellidos | Obligatorio si el DNI todavía no existe en Personal |
| Sede | Obligatoria; sede administrativa por nombre. Se crea si no existe una coincidencia inequívoca |
| Supervisor DNI | Obligatorio; debe existir como supervisor o jefe de operaciones activo |
| Puesto | Obligatorio; agencia o lugar operativo |
| Inicio programado | Obligatorio: fecha y hora completas |
| Fin programado | Obligatorio: posterior al inicio; duración máxima 24 horas por plaza-turno |
| Ingreso real | Fecha-hora del ingreso verificable, o vacío si no se conoce o no hubo presencia |
| Salida real | Fecha-hora posterior al ingreso; obligatoria para importar cumplido |
| Asistencia validada | SI o NO. SI sin ingreso significa ausencia comprobada; NO deja pendiente su verificación |
| Estado turno | sin_confirmar, confirmado, pendiente, cumplido, programado o sin_asignar |
| Evidencias requeridas | Obligatorio; entero mayor o igual a 0 |
| Evidencias registradas | Obligatorio cuando se exigen evidencias; usar 0 cuando faltaron |
| Limite evidencias | Obligatorio cuando se exigen evidencias |
| Fecha registro evidencias | Obligatorio cuando hay registros declarados; fecha del registro declarado completo |
| Tolerancia minutos | Opcional, 0–120; valor inicial 10 |

Usar `YYYY-MM-DD HH:mm` para fecha-hora local, por ejemplo `2026-09-01 22:00` y `2026-09-02 06:00`. También se aceptan fechas-hora de Excel y cadenas ISO con zona explícita. Conservar DNI como texto para no perder ceros iniciales.

No se requiere correo para crear personal desde este lote y no se inventa: puede completarse después en Personal. El nombre completo RESGUARDO se conserva, pero no se divide automáticamente en nombres/apellidos para crear identidades.

**El archivo original no está listo para una importación operativa completa:** además de IDs, carece de identidades verificadas, referencias estables y programación inequívoca. Completar la plantilla evita convertir horas comerciales o de viaje en marcaciones de asistencia por suposición.

Las incidencias no se reconstruyen de Observacion. Se registran en su módulo con tipo, prioridad, responsable, SLA y hechos de atención. No existe evidencia suficiente para interpretar automáticamente todas las notas del tareaje como incidencias.

### Flujo

1. Descargar plantilla y completar sus columnas adicionales. Mantener códigos estables entre archivos.
2. Seleccionar XLSX. Se interpretan las celdas realmente combinadas; no se rellenan celdas vacías arbitrarias. Se ignoran filas con solo fórmulas y no se ejecutan fórmulas ni instrucciones de texto.
3. Revisar total, errores con celda/fila, advertencias y muestra de registros. Corregir y volver a subir cuando existan errores.
4. Confirmar. Se crean primero catálogos y relaciones, después turnos. Si falla una validación de base o de disponibilidad, todo el lote se revierte.
5. El mismo archivo confirmado no vuelve a cargarse. Un Codigo turno ya importado no se sobrescribe con otro archivo; las correcciones se realizan en Turnos para conservar historial.

## Base y capa analítica

Las migraciones en database/migrations se aplican automáticamente al iniciar el backend, con transacción y registro de versiones. También pueden aplicarse con `npm run db:migrate`. No ejecutar schema.sql ni seed.sql para actualizar una instalación existente, porque son scripts de inicialización.

El esquema bi contiene dimensiones de fecha, cliente, personal, sede y servicio, y hechos separados de turno, obligación de evidencia e incidencia. La función `bi.refrescar()` actualiza la carga analítica al confirmar importaciones o guardar evaluaciones. Las evaluaciones operativas conservan su instantánea independiente; las evaluaciones antiguas del método anterior se mantienen en sus tablas originales. Las tablas bi reflejan el último refresco, no cada modificación operativa en tiempo real.

Los permisos de conexión de Power BI dependen de la cuenta usada en la instalación. Las tablas nuevas no exponen ni cambian credenciales. El monitor consulta hechos operativos consistentes al corte; no mezcla scores de versiones anteriores.

## Verificación y ejecución

- `npm test` en backend: reglas de los cinco criterios, límites de tolerancia/SLA, vacantes, información insuficiente, filtros y futuro.
- `npm run test:integration` en backend: requiere acceso a la base configurada. Las escrituras se ejecutan dentro de rollback exterior; comprueba nocturnos, historial, asistencia, incidencias, importación idempotente, capa analítica y API autenticada.
- `npm run lint` y `npm run build` en frontend.
- Iniciar backend con `npm run dev` o `npm start`; iniciar frontend con `npm run dev`. Reiniciar procesos existentes si no usan recarga automática.

Los pesos iniciales son 20 % por criterio y los umbrales iniciales 10, 20, 10, 10 y 30 %. Son configurables desde Método y validación. Su implementación y pruebas no sustituyen la validación de estos parámetros con el responsable operativo.

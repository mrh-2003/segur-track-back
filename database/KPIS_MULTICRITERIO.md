# Monitor multicriterio — 18/11/2026

Modelo `operativo-v4`: cinco criterios y diez KPI, conforme a la referencia del usuario. Cada tasa es numerador / denominador × 100. El modal del monitor contiene las definiciones completas y las fórmulas de agregación.

| Criterio | KPI | Fuente |
|---|---|---|
| C01 Puntualidad y asistencia | 01 Asistencia; 02 Puntualidad | Turnos vencidos, marcaciones validadas y tolerancia |
| C02 Cumplimiento de protocolos y consignas | 03 Protocolos; 04 Consignas | Evidencias de protocolo revisadas y verificaciones de consignas vinculadas al turno |
| C03 Cumplimiento de actividades y rondas | 05 Actividades; 06 Rondas | Obligaciones de tipo actividad y programación de rondas |
| C04 Cumplimiento de reportes operativos | 07 Entrega; 08 Entrega oportuna | Una obligación por reporte requerido, con límite y fecha de entrega |
| C05 Gestión de incidencias | 09 Resolución; 10 Atención oportuna | Cierre y primera atención; plazos independientes desde el registro |

## Flujo integrado

1. **Servicios → Detalle operativo → Plan operativo**: definir actividades, rondas, reportes y consignas. El plazo se expresa en minutos desde el inicio o al cierre. Un intervalo permite repetir una ronda durante el turno. Guardar confirma el plan y actualiza las obligaciones aún no ejecutadas de turnos futuros.
2. **Turnos → Ver detalle**: se generan las obligaciones automáticamente al crear o importar un turno de un servicio con plan confirmado. El turno nocturno conserva su fecha de inicio y calcula el cierre al día siguiente. Supervisión puede aplicar el plan a un turno existente.
3. **Turnos → Actividades, rondas y reportes**: el agente asignado registra su ejecución, entrega el contenido del reporte y verifica las consignas. Una entrega exige contenido; permite cargar hasta seis imágenes JPG, PNG o WEBP de hasta 8 MB cada una, con vista previa. No se solicita escribir enlaces. Supervisión puede registrar la fecha real histórica, sin fechas futuras ni anteriores al inicio del turno.
4. **Incidencias**: captura y muestra por separado los plazos de primera atención y resolución, y registra atención/cierre. Las nuevas incidencias y los casos modificados sin plazo reciben la configuración vigente por prioridad. Primera atención: 60/240/1440 minutos; resolución: 240/1440/2880 minutos. Los campos de cada incidencia permiten especificar otros plazos.
5. **Monitor multicriterio**: consulta los resultados de estos mismos registros. El acceso rápido «Registrar datos KPI» usa el mismo componente de ejecución de Turnos.

Los agentes solo ejecutan sus propios turnos; la configuración de planes, las anulaciones y las fechas históricas corresponden a supervisión. Aplicar nuevamente el plan no duplica las obligaciones. La programación anterior conserva las ejecuciones ya registradas.

## Datos de prueba agregados

La base de demostración se complementó sin reiniciar sus tablas. Contiene 13 planes, 39 plantillas, 3.230 actividades/reportes, 6.494 rondas y 1.408 verificaciones de consignas. Las 768 incidencias tienen plazo de resolución. Los ejemplos cubren cumplimiento, incumplimiento, reportes tardíos, turnos futuros y distintos niveles de criticidad.

Los registros nuevos se identifican con «DEMO» y/o el origen `demo_kpis_20261118`. Los turnos futuros no se penalizan: un servicio que solo tiene programación futura puede mostrar «Sin casos», sin tratarlo como información faltante.

Para completar una base **ya identificada como demo**, ejecutar `npm run db:demo:kpis`. El comando es aditivo, no reinicia tablas y no duplica la programación. Su generador común también es utilizado por `seed-demo.cjs`. Las ejecuciones ingresadas por usuarios se identifican como `ejecucion_usuario` y no son reemplazadas al regenerar la muestra.

## Reglas

- El periodo/franja selecciona turnos por su inicio programado e incidencias por fecha de registro. Las obligaciones pertenecen a esos turnos. Se excluyen eventos posteriores al corte.
- Un turno programado válido es un turno no eliminado cuyo fin programado ya ocurrió. Incluye vacantes e inasistencias. Los asignados requieren validación de asistencia.
- Una obligación es exigible cuando su plazo venció. Una incidencia es exigible para atención/resolución si venció el plazo correspondiente o ya ocurrió ese evento.
- Un denominador cero produce tasa nula, **Sin casos**, y se excluye del promedio. Si ambos KPI están sin casos con información confirmada, el aporte es cero.
- Puntaje del criterio = promedio de las tasas aplicables. Riesgo = mín(100, (100 − puntaje) / umbral × 100). Aporte = riesgo × peso. Criticidad = suma de los cinco aportes. Mayor criticidad implica mayor prioridad.
- `puntaje` se conserva como alias de `criticidad` en el contrato de la API. Las instantáneas históricas conservan su versión. Los nuevos cálculos y guardados usan `operativo-v4`.
- La vista `vw_bi_kpis_operativos` conserva las instantáneas de esta versión como compatibilidad interna. El nuevo informe Power BI utiliza exclusivamente `dw`, según [POWER_BI_KIMBALL.md](POWER_BI_KIMBALL.md).

## Instalación y actualización

Para una base existente: `npm run db:migrate`, luego aplicar `database/views_bi.sql`. Las migraciones 007, 008, 009 y 010 conservan los registros y las evaluaciones anteriores.

Para una base nueva: ejecutar `schema.sql`, `seed.sql` (solo ejemplos; reinicia datos), `npm run db:migrate`, y finalmente `views_bi.sql`. Como alternativa reproducible, usar los dos SQL de `database/instalacion` en su orden. No ejecutar `seed.sql` sobre una base con información que deba conservarse.

`seed-demo.cjs` genera un escenario sintético con planes y obligaciones explícitas. `completar-demo-kpis.cjs` complementa una base demo existente conservando sus registros. No se ejecuta durante el arranque ni se usó para reemplazar la base existente.

Las fechas del escenario se trasladaron al 18/11/2026 en America/Lima, conservando horas y distancias entre eventos. Se respaldó la base antes de las modificaciones. Los SQL completos se regeneraron después del traslado. El archivo `actualizar_fechas_a_hoy.sql` calcula el destino dinámicamente y es idempotente en el mismo día; excluye metadatos de migraciones y criterios.

La captura utiliza la hora de la base de datos para validar las fechas. Un turno que aún no inicia permite consultar la programación; sus acciones de ejecución y verificación permanecen deshabilitadas. El selector prioriza turnos en curso, después finalizados y finalmente futuros.

La carga real con el proveedor configurado se verificó el 18/11/2026 con respuesta 200. La prueba visual cubre la vista previa, envío de archivos, modo claro, oscuro y móvil; las pruebas de integración verifican el guardado de imágenes en reportes y rondas con rollback.

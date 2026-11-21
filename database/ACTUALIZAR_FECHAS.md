# Trasladar las fechas del escenario de prueba

Ejecutar `actualizar_fechas_a_hoy.sql` conectado a la base de Segur Track, desde psql o un editor SQL como pgAdmin. El archivo incluye su propia transacción.

La fecha de referencia es `configuracion_operativa.demo_generada_en`, interpretada en **America/Lima**. Se calcula la diferencia con hoy y se suma la misma cantidad de días a las fechas del escenario.

Ejemplo del cambio aplicado el 18 de noviembre de 2026:

| Antes | Después |
|---|---|
| 3 de noviembre, 08:00 | 17 de noviembre, 08:00 |
| 4 de noviembre, 22:00 | 18 de noviembre, 22:00 |
| 5 de noviembre, 06:00 | 19 de noviembre, 06:00 |

Las horas, duraciones, distancias entre fechas, estados, responsables, IDs y contraseñas se conservan. Se trasladan las columnas de fecha y fecha/hora de las tablas del sistema, además de las fechas completas en JSON de auditoría, filtros, evaluaciones, custodias e importaciones. Los archivos originales archivados como binarios se conservan sin reescribir su contenido.

La dimensión de fechas y los hechos de BI se sincronizan dentro de la misma transacción. Los disparadores recuperan su estado original y el cambio no duplica los registros de auditoría.

El script actualiza también la fecha de referencia: ejecutarlo nuevamente el mismo día no vuelve a desplazar los datos. Solo permite bases marcadas como demostración y no retrocede fechas si la referencia es posterior a hoy.

Antes de aplicarlo se guardó un respaldo verificado en la carpeta `analisis`. La comprobación ensayó el cambio con rollback, comparó todas las columnas de fechas operativas, verificó la conservación de las filas y probó que una segunda ejecución no desplazara los datos nuevamente.

Se excluyen del traslado las fechas administrativas de migraciones y del catálogo de criterios. Su aplicación real no es un evento del escenario.


Actualización 21/11/2026: el traslado conserva las vigencias de metas y las fechas administrativas de usuarios. El esquema `dw` se reconstruye mediante su ETL dentro de la transacción; sus claves SCD no se desplazan manualmente. `npm run db:demo:operativa` aplica el traslado, prepara cuentas únicamente para agentes/supervisores de servicios DEMO-SRV, corrige responsables solo de incidencias sintéticas identificadas, agrega escenarios por agente y sincroniza nuevamente el DW. Los registros reales no reciben responsables inventados. El comando es repetible sin duplicar casos; las fotografías de los ejemplos son evidencias sintéticas identificadas como tales.

Las incidencias que no están identificadas como demostración y sus tablas de seguimiento se excluyen del desplazamiento. El histórico sintético se desplaza conservando intervalos; si un ejemplo antiguo contiene una atención o cierre futuro, el complemento operativo lo sitúa antes del corte manteniendo su duración. Los turnos programados sí pueden continuar en fechas futuras.

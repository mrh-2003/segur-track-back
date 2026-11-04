# Datos y acceso de demostración

La base operativa se reinició el 3 de noviembre de 2026 (America/Lima) por solicitud del usuario. Las tablas de negocio y las tablas analíticas se cargaron con datos sintéticos. El registro de migraciones conserva las versiones del esquema.

## Acceso

Contraseña común de las cuentas de prueba: `DemoSegur2026!`.

| Cuenta | Correo |
|---|---|
| Administrador | admin@segurtrack.com |
| Jefe de operaciones | jefe@segurtrack.com |
| Supervisor | supervisor@segurtrack.com |
| Operador | operador@segurtrack.com |

También existe una cuenta inactiva para verificar el rechazo de acceso: inactivo@segurtrack.com.

## Cobertura de escenarios

Hay 6 clientes, 4 sedes, 12 servicios, 70 personas, 1.608 plazas-turno, 764 incidencias y 2.681 evidencias. Los datos cubren 31 días anteriores a la fecha de carga, el día de carga y programación futura. Los servicios incluyen las cinco métricas calculables y niveles de prioridad alta, media y baja.

Se incluyen turnos cumplidos, pendientes, confirmados, programados, por confirmar y sin cubrir; ingresos puntuales y tardíos; ausencias verificadas y salidas anticipadas; relevos con historial; evidencias aprobadas, observadas, pendientes, tardías y faltantes; incidencias abiertas, en atención y cerradas con responsables y SLA; descansos/licencias; vehículos, transportistas, ubicaciones, contenedores, protocolos, requerimientos, reportes e importación trazable.

La interfaz identifica este conjunto como DEMO. Las tasas y puntajes se calculan desde los registros; no se ocultan problemas de datos con valores inventados. En el conjunto cargado se verificaron los 12 servicios para cada combinación de periodo (3, 7, 30 días o todo) y franja (ambos, diurno y nocturno).

## Comprobaciones

- `node test/demostracion.cjs`: verificación de solo lectura de los cinco criterios y los tres niveles de riesgo.
- `npm test`: reglas de cálculo y tratamiento de vacantes y límites.
- `npm run test:integration`: integración de turnos, incidencias, importaciones y API, con rollback de los registros de prueba.

## Respaldo y reinicio reproducible

Antes del reinicio se guardó un respaldo comprimido de las 43 tablas originales, con manifiesto SHA-256, en la carpeta analisis del proyecto. El archivo conserva datos y secuencias y se verificó su lectura y el orden de restauración.

- `node database/respaldar-datos.cjs`: crea un respaldo nuevo sin modificar la base.
- `node database/restaurar-respaldo.cjs --archivo RUTA`: verifica el respaldo y el orden de restauración sin aplicar cambios.
- Añadir `--aplicar` al comando anterior ejecuta la restauración transaccional.
- `npm run db:demo -- --dry-run`: ensaya la carga completa y termina en rollback.
- `npm run db:demo -- --reset-demo --respaldo-verificado RUTA`: reemplaza los datos activos por una demostración nueva. Requiere un respaldo de la misma base y comprueba que los conteos no hayan cambiado.

El reinicio no se ejecuta al iniciar la aplicación. Si la fecha de la demostración envejece o se modifican los escenarios, se puede regenerar de forma explícita con un respaldo nuevo.

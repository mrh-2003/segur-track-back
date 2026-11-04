# Instalación completa de Segur Track

Los dos scripts corresponden al esquema actualizado hasta la migración 006. Se verifican con PostgreSQL 18 y se ejecutan con **psql**; contienen comandos `\connect` para cambiar a la nueva base.

1. `01_creacion_completa.sql`: crea la base `segur_track` y todos sus esquemas, tablas, relaciones, restricciones, índices, vistas, funciones y disparadores. No carga filas de negocio.
2. `02_inserts_ejemplo.sql`: carga los 12.213 registros de las 43 tablas, incluidos catálogos, operaciones, auditoría, evaluaciones, importaciones, BI y versiones de migración. También restaura las secuencias y conserva los disparadores activos al finalizar.

Ejecutar en este orden, desde esta carpeta:

```powershell
& 'C:/Program Files/PostgreSQL/18/bin/psql.exe' -U postgres -d postgres -f './01_creacion_completa.sql'
& 'C:/Program Files/PostgreSQL/18/bin/psql.exe' -U postgres -d postgres -f './02_inserts_ejemplo.sql'
```

Para usar otro nombre de base, añadir el mismo parámetro `-v nombre_base=segur_track_prueba` en ambos comandos. El primer script exige una base nueva: si el nombre ya existe, se detiene sin borrarla. El segundo está preparado para las tablas vacías que crea el primero.

## Contraseñas de ejemplo

Las seis cuentas del archivo de INSERT usan **DemoSegur2026!**. Al final del archivo se indican individualmente con este formato válido para PostgreSQL:

```sql
-- # admin@segurtrack.com | contraseña: DemoSegur2026!
```

Se usa `-- #` porque `#` por sí solo no es un comentario SQL en PostgreSQL. La columna `clave_hash` contiene bcrypt. Un hash no se puede desencriptar: se generó un hash válido de la contraseña conocida para todas las cuentas **del archivo de ejemplo**, sin modificar las contraseñas de la base actual. La cuenta inactiva sigue inactiva.

## Contenido y comprobación

`conteos.json` enumera las filas por tabla. `verificacion.json` recoge el resultado de ejecutar ambos scripts en una instancia temporal independiente: conteos, contraseñas, disparadores y evaluación de los cinco criterios.

Los datos son una instantánea de demostración del 4 de noviembre de 2026, hora de Lima. Sus archivos y fotografías locales de muestra se visualizan con el frontend del proyecto. Para regenerar los dos SQL desde una base marcada como demo: `node database/exportar-sql-completo.cjs`, desde la carpeta del backend.

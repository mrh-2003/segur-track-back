# Segur Track — Backend API REST

Sistema backend de monitoreo operativo de seguridad para Segur Track.

## Requisitos

- Node.js 18 o superior
- PostgreSQL 14 o superior
- npm 9 o superior

## Variables de Entorno

Crear un archivo `.env` en la raíz de `segur-track-back` tomando como plantilla `.env.example`:

```env
NODE_ENV=development
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=segur_track
DB_USER=postgres
DB_PASSWORD=tu_password
JWT_SECRET=segurtrack_jwt_secret_dev_32chars_ok
JWT_EXPIRATION=8h
CORS_ORIGIN=http://localhost:5173
ADMIN_INITIAL_PASSWORD=Admin1234
POWER_BI_EMBED_URL=
```

## Creación y Población de la Base de Datos

1. Crear la base de datos en PostgreSQL:
```sql
CREATE DATABASE segur_track;
```

2. Ejecutar los scripts SQL en el siguiente orden desde la carpeta `database/`:
```bash
psql -U postgres -d segur_track -f database/schema.sql
psql -U postgres -d segur_track -f database/seed.sql
npm run db:migrate
psql -U postgres -d segur_track -f database/views_bi.sql
```

3. Modelo dimensional para Power BI:
Ejecutar `npm run bi:sync` para la primera carga y `database/acceso-power-bi.sql` como propietario para configurar el grupo de lectura `bi_lector`, sin contraseña incorporada. El administrador debe agregar un LOGIN de conexión a ese grupo. Power BI usa exclusivamente las tablas `dw`, con dimensiones y hechos independientes de las tablas operativas. Las vistas antiguas quedan por compatibilidad.

La API sincroniza cada 60 minutos; administrador y jefe de operaciones también pueden usar **Sincronizar datos** en Dashboard BI. Consulte [el modelo Kimball, flujo, tablas y medidas DAX](database/POWER_BI_KIMBALL.md), actualizado al 19/11/2026. Incluye las diferencias entre la carga del almacén y la actualización de un informe publicado.

## Ejecución del Servidor

```bash
npm install
npm run dev
```

El servidor iniciará en `http://localhost:3001` con prefijo de API en `http://localhost:3001/api/v1`.

## Credenciales Iniciales

- Administrador: `admin@segurtrack.pe` / `Admin1234`
- Supervisor: `supervisor@segurtrack.pe` / `Supervisor1234`
- Operador: `operador@segurtrack.pe` / `Operador1234`

## Estructura de Capas

- `src/routes/`: Definición de endpoints y middlewares de autorización.
- `src/controllers/`: Manejo HTTP exclusivo (req, res, next).
- `src/services/`: Lógica de negocio y cálculo multicriterio MCDA (suma ponderada).
- `src/repositories/`: Consultas SQL parametrizadas a PostgreSQL con eliminación lógica (`eliminado = FALSE`).
- `src/validators/`: Validación de esquemas de entrada con Zod.
- `src/middlewares/`: Autenticación JWT, verificación de roles, manejo global de errores.

El modelo vigente es `operativo-v4` (18/11/2026), con cinco criterios y diez KPI. Consulte [database/KPIS_MULTICRITERIO.md](database/KPIS_MULTICRITERIO.md) para el origen de datos y tratamiento del histórico.

Los módulos Servicios y Turnos programan y ejecutan las obligaciones del monitor. En una base marcada como demostración, `npm run db:demo:kpis` agrega los ejemplos necesarios sin reiniciar datos. Consulte [el resumen de módulos y tablas](database/RESUMEN_CAMBIOS_KPIS.md).


El flujo de Incidencias (21/11/2026) permite atención y resolución con imágenes por el operador responsable, ampliación de plazo con aprobación/rechazo del supervisor y alerta de vencimiento. Incluye migraciones 014–015; ejecutar `npm run db:migrate` y `npm run bi:sync`. En Prioridades el detalle del servicio y los criterios por agente se consultan en un modal. Ver [el detalle de tablas y comportamiento](database/POWER_BI_KIMBALL.md#ampliaciones-de-incidencias-y-análisis-por-agente-21112026).

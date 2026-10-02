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
psql -U postgres -d segur_track -f database/views_bi.sql
```

3. Usuario de solo lectura para Power BI:
El script `views_bi.sql` crea el usuario `bi_lector` con permisos de solo lectura sobre las vistas `vw_bi_*`:
- Usuario: `bi_lector`
- Contraseña por defecto: `BiLector2026!`

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

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS usuarios (
  id                  SERIAL PRIMARY KEY,
  nombre              VARCHAR(120) NOT NULL,
  correo              VARCHAR(120) NOT NULL UNIQUE,
  clave_hash          TEXT         NOT NULL,
  rol                 VARCHAR(20)  NOT NULL CHECK (rol IN ('administrador','supervisor','operador')),
  activo              BOOLEAN      NOT NULL DEFAULT TRUE,
  debe_cambiar_clave  BOOLEAN      NOT NULL DEFAULT FALSE,
  codigo_recuperacion VARCHAR(30),
  recuperacion_expira TIMESTAMPTZ,
  eliminado           BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado_en        TIMESTAMPTZ,
  eliminado_por       INT          REFERENCES usuarios(id),
  creado_en           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sedes (
  id             SERIAL PRIMARY KEY,
  nombre         VARCHAR(120) NOT NULL,
  direccion      TEXT,
  eliminado      BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado_en   TIMESTAMPTZ,
  eliminado_por  INT          REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
  id             SERIAL PRIMARY KEY,
  nombre         VARCHAR(120) NOT NULL,
  contacto       VARCHAR(120),
  eliminado      BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado_en   TIMESTAMPTZ,
  eliminado_por  INT          REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personal (
  id             SERIAL PRIMARY KEY,
  nombres        VARCHAR(80)  NOT NULL,
  apellidos      VARCHAR(80)  NOT NULL,
  documento      VARCHAR(20)  NOT NULL,
  cargo          VARCHAR(20)  NOT NULL CHECK (cargo IN ('supervisor','agente','administrativo')),
  estado         VARCHAR(10)  NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  correo         VARCHAR(120),
  sede_id        INT          NOT NULL REFERENCES sedes(id),
  usuario_id     INT          REFERENCES usuarios(id),
  eliminado      BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado_en   TIMESTAMPTZ,
  eliminado_por  INT          REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_personal_documento
  ON personal(documento) WHERE eliminado = FALSE;

CREATE TABLE IF NOT EXISTS servicios (
  id             SERIAL PRIMARY KEY,
  nombre         VARCHAR(120) NOT NULL,
  cliente_id     INT          NOT NULL REFERENCES clientes(id),
  sede_id        INT          NOT NULL REFERENCES sedes(id),
  supervisor_id  INT          NOT NULL REFERENCES personal(id),
  hora_inicio    TIME         NOT NULL,
  hora_fin       TIME         NOT NULL,
  estado         VARCHAR(15)  NOT NULL DEFAULT 'programado' CHECK (estado IN ('programado','en_curso','finalizado')),
  fecha_inicio   DATE         NOT NULL,
  fecha_fin      DATE,
  eliminado      BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado_en   TIMESTAMPTZ,
  eliminado_por  INT          REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS servicio_personal (
  id             SERIAL PRIMARY KEY,
  servicio_id    INT          NOT NULL REFERENCES servicios(id),
  personal_id    INT          NOT NULL REFERENCES personal(id),
  eliminado      BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado_en   TIMESTAMPTZ,
  eliminado_por  INT          REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS turnos (
  id               SERIAL PRIMARY KEY,
  personal_id      INT          NOT NULL REFERENCES personal(id),
  servicio_id      INT          NOT NULL REFERENCES servicios(id),
  sede_id          INT          NOT NULL REFERENCES sedes(id),
  fecha            DATE         NOT NULL,
  hora_inicio      TIME         NOT NULL,
  hora_fin         TIME         NOT NULL,
  estado           VARCHAR(15)  NOT NULL DEFAULT 'programado'
                   CHECK (estado IN ('programado','confirmado','sin_confirmar','cumplido','pendiente')),
  relevo_pendiente BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado        BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado_en     TIMESTAMPTZ,
  eliminado_por    INT          REFERENCES usuarios(id),
  creado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turnos_personal_fecha
  ON turnos(personal_id, fecha) WHERE eliminado = FALSE;

CREATE TABLE IF NOT EXISTS tipos_incidencia (
  id             SERIAL PRIMARY KEY,
  nombre         VARCHAR(80)  NOT NULL,
  eliminado      BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado_en   TIMESTAMPTZ,
  eliminado_por  INT          REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS seq_incidencias START 1;

CREATE TABLE IF NOT EXISTS incidencias (
  id                  SERIAL PRIMARY KEY,
  codigo              VARCHAR(10)  NOT NULL,
  tipo_incidencia_id  INT          NOT NULL REFERENCES tipos_incidencia(id),
  servicio_id         INT          NOT NULL REFERENCES servicios(id),
  personal_id         INT          REFERENCES personal(id),
  descripcion         TEXT,
  prioridad           VARCHAR(5)   NOT NULL CHECK (prioridad IN ('alta','media','baja')),
  estado              VARCHAR(12)  NOT NULL DEFAULT 'abierta'
                      CHECK (estado IN ('abierta','en_atencion','cerrada')),
  fecha_registro      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  fecha_atencion      TIMESTAMPTZ,
  fecha_cierre        TIMESTAMPTZ,
  registrado_por      INT          NOT NULL REFERENCES usuarios(id),
  eliminado           BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado_en        TIMESTAMPTZ,
  eliminado_por       INT          REFERENCES usuarios(id),
  creado_en           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_incidencias_codigo
  ON incidencias(codigo) WHERE eliminado = FALSE;

CREATE INDEX IF NOT EXISTS idx_incidencias_estado
  ON incidencias(estado) WHERE eliminado = FALSE;

CREATE TABLE IF NOT EXISTS criterios_mcda (
  id             SERIAL PRIMARY KEY,
  codigo         VARCHAR(10)  NOT NULL UNIQUE,
  nombre         VARCHAR(100) NOT NULL,
  descripcion    TEXT,
  peso           NUMERIC(4,3) NOT NULL DEFAULT 0.200,
  activo         BOOLEAN      NOT NULL DEFAULT TRUE,
  eliminado      BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado_en   TIMESTAMPTZ,
  eliminado_por  INT          REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluaciones_multicriterio (
  id               SERIAL PRIMARY KEY,
  servicio_id      INT          NOT NULL REFERENCES servicios(id),
  fecha_evaluacion TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  puntaje_global   NUMERIC(5,2) NOT NULL CHECK (puntaje_global BETWEEN 0 AND 100),
  nivel            VARCHAR(5)   NOT NULL CHECK (nivel IN ('alta','media','baja')),
  eliminado        BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado_en     TIMESTAMPTZ,
  eliminado_por    INT          REFERENCES usuarios(id),
  creado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eval_servicio
  ON evaluaciones_multicriterio(servicio_id) WHERE eliminado = FALSE;

CREATE TABLE IF NOT EXISTS evaluacion_criterios (
  id             SERIAL PRIMARY KEY,
  evaluacion_id  INT          NOT NULL REFERENCES evaluaciones_multicriterio(id),
  criterio_id    INT          NOT NULL REFERENCES criterios_mcda(id),
  puntaje        NUMERIC(5,2) NOT NULL CHECK (puntaje BETWEEN 0 AND 100),
  influye        BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado      BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado_en   TIMESTAMPTZ,
  eliminado_por  INT          REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reportes_generados (
  id             SERIAL PRIMARY KEY,
  tipo           VARCHAR(20)  NOT NULL CHECK (tipo IN ('servicios','turnos','incidencias','bi','multicriterio')),
  categoria      VARCHAR(20)  NOT NULL CHECK (categoria IN ('operativos','incidencias','multicriterio')),
  formato        VARCHAR(5)   NOT NULL CHECK (formato IN ('xlsx','pdf')),
  estado         VARCHAR(12)  NOT NULL DEFAULT 'procesando'
                 CHECK (estado IN ('completado','procesando','error')),
  generado_por   INT          NOT NULL REFERENCES usuarios(id),
  eliminado      BOOLEAN      NOT NULL DEFAULT FALSE,
  eliminado_en   TIMESTAMPTZ,
  eliminado_por  INT          REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actividad_reciente (
  id          SERIAL PRIMARY KEY,
  tipo        VARCHAR(40)  NOT NULL,
  descripcion TEXT         NOT NULL,
  usuario_id  INT          REFERENCES usuarios(id),
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actividad_creado_en ON actividad_reciente(creado_en DESC);

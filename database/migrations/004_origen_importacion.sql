ALTER TABLE importaciones ADD COLUMN IF NOT EXISTS archivo BYTEA;
CREATE TABLE IF NOT EXISTS importacion_filas (
 importacion_id UUID NOT NULL REFERENCES importaciones(id), fila INT NOT NULL,
 turno_id INT NOT NULL UNIQUE REFERENCES turnos(id),
 PRIMARY KEY(importacion_id,fila)
);

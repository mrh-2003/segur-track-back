-- Flujo operativo: las solicitudes no modifican el SLA original ni detienen el reloj.
ALTER TABLE public.incidencias ADD COLUMN evidencias JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(evidencias)='array');
ALTER TABLE public.incidencias ADD COLUMN plazo_resolucion_extendido TIMESTAMPTZ;
CREATE TABLE public.incidencias_seguimiento (
 id BIGSERIAL PRIMARY KEY, incidencia_id INT NOT NULL REFERENCES public.incidencias(id),
 accion TEXT NOT NULL CHECK(accion IN ('registrar','atender','avance','resolver','solicitar_ampliacion','aprobar_ampliacion','rechazar_ampliacion')),
 comentario TEXT NOT NULL, evidencias JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(evidencias)='array'),
 usuario_id INT NOT NULL REFERENCES public.usuarios(id), creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX incidencias_seguimiento_orden ON public.incidencias_seguimiento(incidencia_id,creado_en,id);
CREATE TABLE public.incidencias_ampliaciones (
 id BIGSERIAL PRIMARY KEY, incidencia_id INT NOT NULL REFERENCES public.incidencias(id),
 solicitado_por INT NOT NULL REFERENCES public.usuarios(id), solicitado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 motivo TEXT NOT NULL CHECK(length(trim(motivo))>=10), evidencias JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(evidencias)='array'),
 plazo_anterior TIMESTAMPTZ NOT NULL, plazo_solicitado TIMESTAMPTZ NOT NULL,
 estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','aprobada','rechazada','cancelada')),
 decidido_por INT REFERENCES public.usuarios(id), decidido_en TIMESTAMPTZ, respuesta TEXT,
 CHECK(plazo_solicitado>plazo_anterior),
 CHECK(estado NOT IN ('aprobada','rechazada') OR (decidido_por IS NOT NULL AND decidido_en IS NOT NULL AND length(trim(respuesta))>=3)),
 CHECK(decidido_por IS NULL OR decidido_por<>solicitado_por)
);
CREATE UNIQUE INDEX incidencias_una_ampliacion_pendiente ON public.incidencias_ampliaciones(incidencia_id) WHERE estado='pendiente';
CREATE INDEX incidencias_ampliaciones_bandeja ON public.incidencias_ampliaciones(estado,incidencia_id);

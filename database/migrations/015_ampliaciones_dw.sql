-- El DW mantiene sus FK exclusivamente internas; estas columnas son medidas y fechas copiadas por ETL.
ALTER TABLE dw.fact_incidencia ADD COLUMN limite_resolucion_original TIMESTAMPTZ,
 ADD COLUMN ampliaciones_aprobadas INT NOT NULL DEFAULT 0,
 ADD COLUMN minutos_ampliados NUMERIC NOT NULL DEFAULT 0,
 ADD COLUMN ampliacion_pendiente INT NOT NULL DEFAULT 0;
UPDATE dw.fact_incidencia SET limite_resolucion_original=limite_resolucion;
DO $m$
DECLARE definicion TEXT;
BEGIN
 definicion=pg_get_functiondef('etl.cargar_dw(bigint,timestamp with time zone)'::regprocedure);
 definicion=replace(definicion,'i.fecha_registro+make_interval(mins=>i.sla_resolucion_min)',
   'COALESCE(i.plazo_resolucion_extendido,i.fecha_registro+make_interval(mins=>i.sla_resolucion_min))');
 definicion=replace(definicion,'INSERT INTO dw.fact_servicio_diario', $nuevo$
 UPDATE dw.fact_incidencia f SET
   limite_resolucion_original=i.fecha_registro+make_interval(mins=>i.sla_resolucion_min),
   ampliaciones_aprobadas=(SELECT COUNT(*) FROM public.incidencias_ampliaciones a WHERE a.incidencia_id=i.id AND a.estado='aprobada' AND a.decidido_en<=p_corte),
   minutos_ampliados=CASE WHEN i.plazo_resolucion_extendido IS NOT NULL THEN EXTRACT(EPOCH FROM (i.plazo_resolucion_extendido-i.fecha_registro))/60-i.sla_resolucion_min ELSE 0 END,
   ampliacion_pendiente=(EXISTS(SELECT 1 FROM public.incidencias_ampliaciones a WHERE a.incidencia_id=i.id AND a.estado='pendiente'))::int
 FROM public.incidencias i WHERE i.id=f.incidencia_origen_id;
 INSERT INTO dw.fact_servicio_diario
 $nuevo$);
 EXECUTE definicion;
END $m$;

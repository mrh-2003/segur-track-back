const p=require('../src/config/db');
p.query(`WITH RECURSIVE vistas AS (
 SELECT DISTINCT v.oid,0 nivel FROM pg_depend d JOIN pg_rewrite r ON r.oid=d.objid JOIN pg_class v ON v.oid=r.ev_class JOIN pg_attribute a ON a.attrelid=d.refobjid AND a.attnum=d.refobjsubid WHERE d.refobjid='incidencias'::regclass AND a.attname='prioridad'
 UNION ALL
 SELECT v.oid,x.nivel+1 FROM vistas x JOIN pg_depend d ON d.refobjid=x.oid JOIN pg_rewrite r ON r.oid=d.objid JOIN pg_class v ON v.oid=r.ev_class WHERE v.oid<>x.oid AND x.nivel<10
) SELECT c.oid,c.oid::regclass::text vista,max(v.nivel) nivel,pg_get_viewdef(c.oid,true) definicion,c.relowner::regrole::text propietario,c.relacl FROM vistas v JOIN pg_class c ON c.oid=v.oid GROUP BY c.oid ORDER BY max(v.nivel)`).then(r=>console.log(JSON.stringify(r.rows,null,2))).catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>p.end());

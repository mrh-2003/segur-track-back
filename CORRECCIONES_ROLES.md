# Correcciones de supervisor y operador

La migración `016_alcance_roles_asistencia.sql` agrega cliente y supervisor a cada sede, coordenadas de marcación y notificaciones privadas de asignación de turnos. Se aplica con `npm run db:migrate` o al iniciar el backend.

- Supervisor: consulta clientes y sedes vigentes; no puede crearlos ni modificarlos. No crea servicios. Los servicios, turnos, incidencias, evidencias y resultados del monitor se limitan a sus servicios asignados. La consulta y selección de agentes se limita a sus servicios o sedes, sin extenderse al cliente completo.
- Cada sede tiene cliente y supervisor. El formulario de servicios filtra las sedes por cliente y selecciona su supervisor automáticamente. Jefatura y administración pueden escoger otro supervisor activo.
- Operador: consulta únicamente sus turnos, incluyendo su historial y filtros por sede, estado y fechas. No accede al resumen general ni al directorio de personal. Su panel muestra su turno, tareas, consignas e incidencias propias, sin controles de edición del servicio.
- La programación y reasignación rechazan cruces horarios y otro servicio en la misma semana de Lima (lunes a domingo). Los turnos nocturnos consideran su fecha final real. El selector conserva todo el personal vinculado y marca en rojo con un asterisco a quienes no se pueden asignar. Debajo muestra los motivos reales: cruces con servicio y fechas, otro servicio en la semana, ausencia o jornada incompatible. Las opciones bloqueadas no permiten asignación.
- Las asignaciones y reasignaciones generan notificaciones para el usuario del agente; la campana consulta novedades cada 30 segundos. La notificación abre la semana correspondiente al turno.
- Las marcaciones guardan hora del servidor y latitud, longitud y precisión del dispositivo. El navegador debe permitir geolocalización y ejecutarse sobre HTTPS o localhost. El ingreso del operador admite desde 30 minutos antes del comienzo hasta el final del turno.
- El operador reporta incidencias de su servicio en curso dentro de su turno activo. El supervisor solicita las ampliaciones; únicamente el jefe de operaciones las aprueba o rechaza. Solicitar no detiene el plazo vigente.
- El progreso personal mide tareas ejecutadas y consignas verificadas, más incidencias propias resueltas. Todos los compromisos completos equivalen al 100%; un turno sin compromisos muestra un estado vacío.

## Datos existentes

La migración completa las relaciones de sede solamente cuando sus servicios identifican un único cliente o supervisor. No elige arbitrariamente entre varios clientes. Las cuatro sedes sintéticas compartidas se regularizaron el 23/11/2026: se conservaron sus referencias base y se crearon ocho sedes por cliente para mantener el cliente original de cada servicio demo. Se actualizaron las sedes de sus turnos y agentes sintéticos. Los registros no demo se conservaron.

## Verificación

- `npm test`: pruebas unitarias de evaluación y horarios.
- `npm run test:roles:integration`: casos de autorización, pertenencia, programación, asistencia, notificaciones, ampliaciones y progreso; se ejecutan en una transacción con rollback.
- `npm run test:incidencias:integration`: regresión del flujo de incidencias y atribución de KPI por agente.
- Frontend: `npm run lint`, `npm run build` y `node --test test/modal-detalle.test.mjs`.

Reiniciar los procesos del backend y frontend para cargar los cambios de código.

El Dashboard BI muestra únicamente sus reportes e indicadores nativos; se retiraron el iframe de Power BI, su aviso de publicación y la consulta al endpoint de embed.

## Ayudas de controles y secuencias demo (23/11/2026)

Los botones, selectores y campos bloqueables declaran un motivo contextual. La ayuda aparece al pasar el puntero, enfocar con teclado o tocar el contenedor; los campos de perfil y el plan en modo consulta también muestran una explicación visible. Una prueba recorre todo el frontend para evitar nuevos controles deshabilitados sin motivo.

Asignar agente ahora muestra y enfoca su formulario, conserva los candidatos incompatibles con sus motivos y exige agente disponible más motivo. Tras asignar, confirmar o marcar asistencia, se actualizan los prerrequisitos del panel de ejecución. La API exige agente, confirmación, comienzo del turno e ingreso antes de completar tareas o verificar consignas, incluso para supervisión.

Se regularizaron exclusivamente los ejemplos identificados por servicios `DEMO-SRV-*` y marcadores demo. La auditoría contempla 15 comprobaciones sobre sedes, pertenencia, asistencia, evidencias, tareas, reportes, incidencias, ampliaciones y trazabilidad: todas terminaron en cero. Los turnos futuros o vacantes conservan una secuencia pendiente válida. No se generaron coordenadas ficticias de asistencia.

Los generadores de KPI, muestra BI y actualización operativa ejecutan la regularización antes del commit. La reparación verifica idempotencia y conserva un respaldo comprimido previo en `analisis/respaldo-flujos-demo-*.json.gz`; además comprueba que no cambien los turnos e incidencias no demo. BI se sincronizó después de ambas reparaciones.

Comandos: `npm run db:demo:verificar` (auditoría), `npm run db:demo:ensayar` (rollback), `npm run db:demo:regularizar` (respaldo, reparación y sincronización).

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

## Inicio del supervisor

Inicio está disponible para administración, jefatura y supervisión. El supervisor ve únicamente el resumen de sus servicios, agentes de sus servicios o sedes, incidencias y actividad relacionada. La actividad usa trazas vinculadas por servicio; no utiliza la bitácora global. Sin asignaciones, devuelve un resumen vacío. Los accesos rápidos respetan el rol: Mi personal es consulta, sin crear personal ni importar datos. El operador conserva su panel personal.

## Asignación de sedes (25/11/2026)

La migración 017 conserva las sedes actuales en personal_sedes y permite crear sedes sin supervisor predeterminado. Los supervisores requieren una o varias sedes, sin límite; para jefes son opcionales y no limitan su acceso global. Los agentes tienen exactamente una sede. La sede principal se conserva para compatibilidad con turnos, reportes e importadores; triggers diferidos comprueban la cardinalidad al cerrar cada transacción.

Personal muestra un desplegable con búsqueda, casillas y etiquetas para supervisores y jefes. Cambiar sede del agente usa PATCH /personal/:id/sede: administrador y jefe pueden modificar cualquier agente; el supervisor únicamente agentes a su cargo y destinos de sus sedes o servicios. Esta acción no concede edición de cargos, cuentas o contraseñas. El catálogo de destinos aplica el mismo alcance que la escritura.

La creación de supervisores y operadores desde /usuarios se deriva a Personal para exigir su perfil y sedes. Los cambios de cargo de perfiles operativos se realizan desde Personal. Antes de dejar de ser supervisor debe reasignar sus servicios. Las sedes con personal o servicios no se pueden eliminar.

Incidencias ofrece Eliminar a administrador y jefe de operaciones, con confirmación. El borrado es lógico y conserva autor y fecha, seguimiento y evidencias; el registro queda excluido de listas, detalle, indicadores y reportes. Supervisores y agentes no pueden eliminar incidencias.

Validación: npm run test:sedes:integration, npm run test:roles:integration y npm test en backend; lint, build y pruebas de componentes en frontend. Las pruebas de integración usan rollback.

## Alta de personal y correos de cuentas eliminadas

Se reprodujo el error 23505 de usuarios_correo_key al crear un jefe con el correo de una cuenta eliminada. La migración 018 reemplaza la unicidad global por un índice sobre el correo normalizado de cuentas no eliminadas. El historial de la cuenta anterior se conserva y la nueva persona obtiene otra cuenta; no se reactiva ni se reasigna la identidad eliminada. Se impide vincular una cuenta a varios perfiles vigentes y convertir cuentas de otro rol durante un alta.

Los conflictos activos indican el campo concreto (correo o DNI). El formulario conserva sus valores y muestra los errores dentro del modal, con bloqueo de envíos simultáneos mientras guarda. Se actualizaron los upserts de recuperación y preparación demo para el nuevo índice.

Migración aplicada con npm run db:migrate. Regresión transaccional: npm run test:personal:integration (14 comprobaciones, rollback).

## Administrador con sedes opcionales

El administrador tiene acceso global en el middleware de autorización y puede crear, editar y eliminar registros de todos los módulos, así como solicitar y decidir ampliaciones de incidencias. Se conservan las reglas de integridad del flujo, incluida la separación entre solicitante y revisor.

Personal incorpora el cargo Administrador exclusivamente para cuentas administradoras. Las sedes son opcionales y se pueden elegir varias, igual que para jefe de operaciones; no delimitan el acceso global. La migración 019 amplía el cargo permitido y conserva las asignaciones múltiples al editar el perfil. Los mapeos de creación, edición y recuperación de contraseña mantienen el rol administrador.

Jefatura no puede crear administradores, promover perfiles a administrador, modificar o eliminar sus perfiles ni reiniciar sus claves. La protección se comprueba en el backend y se refleja en el formulario y la tabla de Personal.

Prueba transaccional: npm run test:admin:integration. La migración se aplica con npm run db:migrate. Los registros de prueba se revierten y no repueblan la base limpiada.

La autenticación consulta el estado y rol vigentes de la cuenta: los tokens anteriores no conservan permisos tras un cambio de rol y una cuenta eliminada o inactiva ya no puede usar sus sesiones.

## Retiro de Administrativo

Los únicos cargos admitidos son Administrador, Jefe de Operaciones, Supervisor y Agente. Administrativo se retiró del formulario, validadores, documentación de API, esquema e instaladores y generadores de ejemplo. La migración 020 convierte registros antiguos al cargo Administrador (y su cuenta vigente al mismo rol) y restringe personal_cargo_check a los cuatro cargos admitidos. Administrador mantiene las sedes opcionales.

## Cuentas base y acciones de tablas

Se verificaron las cuatro cuentas base admin@segurtrack.com, supervisor@segurtrack.com, jefe@segurtrack.com y operador@segurtrack.com. Todas quedan activas con la contraseña indicada por el usuario y sin cambio de clave obligatorio. Se conservaron sus nombres, documentos y asignaciones vigentes. La contraseña solo se recibe en CUENTAS_BASE_CLAVE; el script npm run db:cuentas:base no se ejecuta automáticamente y no contiene credenciales en texto.

Las columnas de acciones usan botones de icono con tooltip al pasar el cursor o enfocar, etiqueta accesible y ayuda cuando están bloqueados. La regla se comprueba en el frontend mediante test/acciones-tablas.test.mjs.

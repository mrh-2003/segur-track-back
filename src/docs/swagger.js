'use strict';

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Segur Track API',
    version: '1.0.0',
    description: 'Documentación interactiva de la API REST de Segur Track - Sistema de Monitoreo Operativo de Seguridad',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Ingrese el token JWT obtenido en /auth/login',
      },
    },
    schemas: {
      RespuestaExito: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
          datos: { type: 'object' },
          meta: { type: 'object' },
        },
      },
      RespuestaError: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: false },
          mensaje: { type: 'string', example: 'Descripción del error' },
          errores: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                campo: { type: 'string', example: 'correo' },
                mensaje: { type: 'string', example: 'Formato de correo inválido' },
              },
            },
          },
        },
      },
      LoginEntrada: {
        type: 'object',
        required: ['correo', 'clave'],
        properties: {
          correo: { type: 'string', format: 'email', example: 'admin@segurtrack.com' },
          clave: { type: 'string', example: 'Admin1234' },
        },
      },
      PersonalEntrada: {
        type: 'object',
        required: ['nombres', 'apellidos', 'documento', 'cargo', 'sedeId'],
        properties: {
          nombres: { type: 'string', example: 'Carlos' },
          apellidos: { type: 'string', example: 'Mendoza' },
          documento: { type: 'string', example: '44556677' },
          cargo: { type: 'string', enum: ['supervisor', 'agente', 'administrativo'], example: 'agente' },
          sedeId: { type: 'integer', example: 1 },
          usuarioId: { type: 'integer', nullable: true, example: null },
        },
      },
      EstadoPersonalEntrada: {
        type: 'object',
        required: ['estado'],
        properties: {
          estado: { type: 'string', enum: ['activo', 'inactivo'], example: 'inactivo' },
        },
      },
      ServicioEntrada: {
        type: 'object',
        required: ['nombre', 'clienteId', 'sedeId', 'supervisorId', 'horaInicio', 'horaFin', 'fechaInicio'],
        properties: {
          nombre: { type: 'string', example: 'Vigilancia Planta Norte' },
          clienteId: { type: 'integer', example: 1 },
          sedeId: { type: 'integer', example: 1 },
          supervisorId: { type: 'integer', example: 1 },
          horaInicio: { type: 'string', example: '06:00' },
          horaFin: { type: 'string', example: '14:00' },
          fechaInicio: { type: 'string', format: 'date', example: '2025-05-01' },
          fechaFin: { type: 'string', format: 'date', nullable: true, example: null },
          estado: { type: 'string', enum: ['programado', 'en_curso', 'finalizado'], example: 'en_curso' },
          personalIds: { type: 'array', items: { type: 'integer' }, example: [2, 4] },
        },
      },
      TurnoEntrada: {
        type: 'object',
        required: ['personalId', 'servicioId', 'sedeId', 'fecha', 'horaInicio', 'horaFin'],
        properties: {
          personalId: { type: 'integer', example: 2 },
          servicioId: { type: 'integer', example: 1 },
          sedeId: { type: 'integer', example: 1 },
          fecha: { type: 'string', format: 'date', example: '2025-05-05' },
          horaInicio: { type: 'string', example: '06:00' },
          horaFin: { type: 'string', example: '14:00' },
          estado: { type: 'string', enum: ['programado', 'confirmado', 'sin_confirmar', 'cumplido', 'pendiente'], example: 'programado' },
          relevoPendiente: { type: 'boolean', example: false },
        },
      },
      IncidenciaEntrada: {
        type: 'object',
        required: ['tipoIncidenciaId', 'servicioId', 'descripcion', 'prioridad'],
        properties: {
          tipoIncidenciaId: { type: 'integer', example: 1 },
          servicioId: { type: 'integer', example: 1 },
          descripcion: { type: 'string', example: 'Intento de acceso fuera de horario' },
          prioridad: { type: 'string', enum: ['alta', 'media', 'baja'], example: 'media' },
        },
      },
      EstadoIncidenciaEntrada: {
        type: 'object',
        required: ['estado'],
        properties: {
          estado: { type: 'string', enum: ['abierta', 'en_atencion', 'cerrada'], example: 'en_atencion' },
        },
      },
      PesosMcdaEntrada: {
        type: 'object',
        required: ['pesos'],
        properties: {
          pesos: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'peso'],
              properties: {
                id: { type: 'integer', example: 1 },
                peso: { type: 'number', example: 0.20 },
              },
            },
          },
        },
      },
      EvaluarMcdaEntrada: {
        type: 'object',
        properties: {
          dias: { type: 'integer', example: 30 },
        },
      },
      ReporteGenerarEntrada: {
        type: 'object',
        required: ['tipo', 'formato'],
        properties: {
          tipo: { type: 'string', enum: ['servicios', 'turnos', 'incidencias', 'bi', 'multicriterio'], example: 'operativos' },
          formato: { type: 'string', enum: ['xlsx', 'pdf'], example: 'xlsx' },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesión',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginEntrada' } } },
        },
        responses: {
          200: { description: 'Sesión iniciada con éxito', content: { 'application/json': { schema: { $ref: '#/components/schemas/RespuestaExito' } } } },
          400: { description: 'Datos inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/RespuestaError' } } } },
          401: { description: 'Credenciales inválidas', content: { 'application/json': { schema: { $ref: '#/components/schemas/RespuestaError' } } } },
        },
      },
    },
    '/auth/perfil': {
      get: {
        tags: ['Auth'],
        summary: 'Obtener perfil del usuario autenticado',
        responses: {
          200: { description: 'Perfil obtenido', content: { 'application/json': { schema: { $ref: '#/components/schemas/RespuestaExito' } } } },
          401: { description: 'No autenticado' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Cerrar sesión',
        responses: {
          200: { description: 'Sesión cerrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/RespuestaExito' } } } },
        },
      },
    },

    '/inicio/resumen': {
      get: {
        tags: ['Inicio'],
        summary: 'KPIs principales de inicio y variaciones',
        responses: {
          200: { description: 'Resumen obtenido', content: { 'application/json': { schema: { $ref: '#/components/schemas/RespuestaExito' } } } },
        },
      },
    },
    '/inicio/actividad-operativa': {
      get: {
        tags: ['Inicio'],
        summary: 'Gráfico de actividad operativa',
        responses: {
          200: { description: 'Datos obtenidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/RespuestaExito' } } } },
        },
      },
    },
    '/inicio/actividad-reciente': {
      get: {
        tags: ['Inicio'],
        summary: 'Listado de actividad reciente del sistema',
        responses: {
          200: { description: 'Actividad obtenida', content: { 'application/json': { schema: { $ref: '#/components/schemas/RespuestaExito' } } } },
        },
      },
    },

    '/personal': {
      get: {
        tags: ['Personal'],
        summary: 'Listar personal con filtros y paginación',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Búsqueda por nombre o documento' },
          { name: 'estado', in: 'query', schema: { type: 'string', enum: ['activo', 'inactivo'] } },
          { name: 'cargo', in: 'query', schema: { type: 'string', enum: ['supervisor', 'agente', 'administrativo'] } },
          { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limite', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: {
          200: { description: 'Listado de personal', content: { 'application/json': { schema: { $ref: '#/components/schemas/RespuestaExito' } } } },
        },
      },
      post: {
        tags: ['Personal'],
        summary: 'Crear nuevo personal',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PersonalEntrada' } } },
        },
        responses: {
          201: { description: 'Personal creado', content: { 'application/json': { schema: { $ref: '#/components/schemas/RespuestaExito' } } } },
          400: { description: 'Validación fallida' },
          409: { description: 'Documento duplicado' },
        },
      },
    },
    '/personal/resumen': {
      get: {
        tags: ['Personal'],
        summary: 'KPIs de personal (totales, activos, inactivos, cargos)',
        responses: {
          200: { description: 'Resumen obtenido', content: { 'application/json': { schema: { $ref: '#/components/schemas/RespuestaExito' } } } },
        },
      },
    },
    '/personal/{id}': {
      get: {
        tags: ['Personal'],
        summary: 'Obtener personal por ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Personal encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/RespuestaExito' } } } },
          404: { description: 'No encontrado' },
        },
      },
      put: {
        tags: ['Personal'],
        summary: 'Actualizar personal por ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PersonalEntrada' } } },
        },
        responses: {
          200: { description: 'Personal actualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/RespuestaExito' } } } },
          404: { description: 'No encontrado' },
        },
      },
      delete: {
        tags: ['Personal'],
        summary: 'Eliminar personal (borrado lógico)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Personal eliminado lógicamente', content: { 'application/json': { schema: { $ref: '#/components/schemas/RespuestaExito' } } } },
          404: { description: 'No encontrado' },
        },
      },
    },
    '/personal/{id}/estado': {
      patch: {
        tags: ['Personal'],
        summary: 'Cambiar estado de personal (activo/inactivo)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/EstadoPersonalEntrada' } } },
        },
        responses: {
          200: { description: 'Estado actualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/RespuestaExito' } } } },
          404: { description: 'No encontrado' },
        },
      },
    },

    '/turnos': {
      post: {
        tags: ['Turnos'],
        summary: 'Asignar un nuevo turno',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TurnoEntrada' } } },
        },
        responses: {
          201: { description: 'Turno creado con éxito' },
          400: { description: 'Validación o solapamiento de turno' },
        },
      },
    },
    '/turnos/semana': {
      get: {
        tags: ['Turnos'],
        summary: 'Obtener cuadrícula de turnos de la semana',
        parameters: [
          { name: 'desde', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Fecha inicio YYYY-MM-DD' },
          { name: 'hasta', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Fecha fin YYYY-MM-DD' },
          { name: 'sedeId', in: 'query', schema: { type: 'integer' }, description: 'Filtrar por sede' },
        ],
        responses: {
          200: { description: 'Turnos semanales' },
        },
      },
    },
    '/turnos/resumen': {
      get: {
        tags: ['Turnos'],
        summary: 'KPIs de turnos (programados, cobertura, pendientes)',
        responses: {
          200: { description: 'Resumen obtenido' },
        },
      },
    },
    '/turnos/alertas': {
      get: {
        tags: ['Turnos'],
        summary: 'Alertas operativas del día (relevos, sin confirmar)',
        responses: {
          200: { description: 'Alertas obtenidas' },
        },
      },
    },
    '/turnos/{id}': {
      put: {
        tags: ['Turnos'],
        summary: 'Actualizar turno por ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TurnoEntrada' } } },
        },
        responses: {
          200: { description: 'Turno actualizado' },
        },
      },
      delete: {
        tags: ['Turnos'],
        summary: 'Eliminar turno (borrado lógico)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Turno eliminado lógicamente' },
        },
      },
    },
    '/turnos/{id}/confirmar': {
      patch: {
        tags: ['Turnos'],
        summary: 'Confirmar asistencia a turno',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Turno confirmado' },
        },
      },
    },

    '/servicios': {
      get: {
        tags: ['Servicios'],
        summary: 'Listar servicios con filtros',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'clienteId', in: 'query', schema: { type: 'integer' } },
          { name: 'estado', in: 'query', schema: { type: 'string', enum: ['programado', 'en_curso', 'finalizado'] } },
          { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limite', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: {
          200: { description: 'Listado de servicios' },
        },
      },
      post: {
        tags: ['Servicios'],
        summary: 'Crear nuevo servicio',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ServicioEntrada' } } },
        },
        responses: {
          201: { description: 'Servicio creado' },
        },
      },
    },
    '/servicios/resumen': {
      get: {
        tags: ['Servicios'],
        summary: 'KPIs de servicios (activos, finalizados, cumplimiento)',
        responses: {
          200: { description: 'Resumen obtenido' },
        },
      },
    },
    '/servicios/{id}': {
      get: {
        tags: ['Servicios'],
        summary: 'Detalle rápido de un servicio',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Detalle del servicio' },
        },
      },
      put: {
        tags: ['Servicios'],
        summary: 'Actualizar servicio por ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ServicioEntrada' } } },
        },
        responses: {
          200: { description: 'Servicio actualizado' },
        },
      },
      delete: {
        tags: ['Servicios'],
        summary: 'Eliminar servicio (borrado lógico)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Servicio eliminado' },
        },
      },
    },
    '/servicios/{id}/estado': {
      patch: {
        tags: ['Servicios'],
        summary: 'Cambiar estado de servicio',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['estado'],
                properties: {
                  estado: { type: 'string', enum: ['programado', 'en_curso', 'finalizado'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Estado actualizado' },
        },
      },
    },

    '/incidencias': {
      get: {
        tags: ['Incidencias'],
        summary: 'Listar incidencias',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'tipoId', in: 'query', schema: { type: 'integer' } },
          { name: 'estado', in: 'query', schema: { type: 'string', enum: ['abierta', 'en_atencion', 'cerrada'] } },
          { name: 'prioridad', in: 'query', schema: { type: 'string', enum: ['alta', 'media', 'baja'] } },
          { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limite', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: {
          200: { description: 'Listado de incidencias' },
        },
      },
      post: {
        tags: ['Incidencias'],
        summary: 'Registrar nueva incidencia',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/IncidenciaEntrada' } } },
        },
        responses: {
          201: { description: 'Incidencia creada con código generado' },
        },
      },
    },
    '/incidencias/resumen': {
      get: {
        tags: ['Incidencias'],
        summary: 'KPIs de incidencias (abiertas, en atención, cerradas)',
        responses: {
          200: { description: 'Resumen obtenido' },
        },
      },
    },
    '/incidencias/recientes': {
      get: {
        tags: ['Incidencias'],
        summary: 'Listado rápido de incidencias recientes',
        responses: {
          200: { description: 'Incidencias recientes' },
        },
      },
    },
    '/incidencias/tipos': {
      get: {
        tags: ['Incidencias'],
        summary: 'Listar catálogo de tipos de incidencia',
        responses: {
          200: { description: 'Tipos de incidencia' },
        },
      },
    },
    '/incidencias/{id}': {
      get: {
        tags: ['Incidencias'],
        summary: 'Obtener detalle de incidencia',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Detalle de incidencia' },
        },
      },
      put: {
        tags: ['Incidencias'],
        summary: 'Actualizar incidencia por ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/IncidenciaEntrada' } } },
        },
        responses: {
          200: { description: 'Incidencia actualizada' },
        },
      },
      delete: {
        tags: ['Incidencias'],
        summary: 'Eliminar incidencia (borrado lógico)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Incidencia eliminada' },
        },
      },
    },
    '/incidencias/{id}/estado': {
      patch: {
        tags: ['Incidencias'],
        summary: 'Cambiar estado de incidencia (abierta, en_atencion, cerrada)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/EstadoIncidenciaEntrada' } } },
        },
        responses: {
          200: { description: 'Estado de incidencia actualizado' },
        },
      },
    },

    '/bi/indicadores': {
      get: {
        tags: ['Dashboard BI'],
        summary: 'Indicadores KPI para el Dashboard BI',
        parameters: [
          { name: 'periodo', in: 'query', schema: { type: 'string' } },
          { name: 'clienteId', in: 'query', schema: { type: 'integer' } },
          { name: 'servicioId', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Indicadores BI' },
        },
      },
    },
    '/bi/evolucion-cumplimiento': {
      get: {
        tags: ['Dashboard BI'],
        summary: 'Datos para gráfico de evolución del cumplimiento',
        responses: {
          200: { description: 'Evolución temporal' },
        },
      },
    },
    '/bi/incidencias-por-tipo': {
      get: {
        tags: ['Dashboard BI'],
        summary: 'Datos para gráfico de dona de incidencias por tipo',
        responses: {
          200: { description: 'Distribución por tipo' },
        },
      },
    },
    '/bi/desempeno-servicios': {
      get: {
        tags: ['Dashboard BI'],
        summary: 'Tabla de desempeño por servicio',
        responses: {
          200: { description: 'Desempeño de servicios' },
        },
      },
    },
    '/bi/embed': {
      get: {
        tags: ['Dashboard BI'],
        summary: 'URL de integración del informe embebido de Power BI',
        responses: {
          200: { description: 'URL de informe' },
        },
      },
    },

    '/multicriterio/criterios': {
      get: {
        tags: ['Monitor Multicriterio'],
        summary: 'Obtener criterios MCDA y sus pesos actuales',
        responses: {
          200: { description: 'Criterios y pesos' },
        },
      },
      put: {
        tags: ['Monitor Multicriterio'],
        summary: 'Actualizar pesos de criterios (solo Administrador)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PesosMcdaEntrada' } } },
        },
        responses: {
          200: { description: 'Pesos actualizados' },
        },
      },
    },
    '/multicriterio/evaluar': {
      post: {
        tags: ['Monitor Multicriterio'],
        summary: 'Ejecutar evaluación multicriterio sobre los servicios',
        requestBody: {
          required: false,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/EvaluarMcdaEntrada' } } },
        },
        responses: {
          200: { description: 'Evaluación ejecutada y persistida' },
        },
      },
    },
    '/multicriterio/resultado': {
      get: {
        tags: ['Monitor Multicriterio'],
        summary: 'Obtener último resultado de evaluación multicriterio',
        responses: {
          200: { description: 'Resultados y clasificación de criticidad' },
        },
      },
    },
    '/multicriterio/servicios/{id}': {
      get: {
        tags: ['Monitor Multicriterio'],
        summary: 'Detalle de evaluación por criterios de un servicio',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Detalle de criterios del servicio' },
        },
      },
    },

    '/reportes': {
      get: {
        tags: ['Reportes'],
        summary: 'Listar reportes disponibles para generación',
        responses: {
          200: { description: 'Reportes disponibles' },
        },
      },
    },
    '/reportes/historial': {
      get: {
        tags: ['Reportes'],
        summary: 'Historial de reportes generados',
        responses: {
          200: { description: 'Historial de reportes' },
        },
      },
    },
    '/reportes/generar': {
      post: {
        tags: ['Reportes'],
        summary: 'Generar reporte en formato XLSX o PDF',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ReporteGenerarEntrada' } } },
        },
        responses: {
          201: { description: 'Reporte generado' },
        },
      },
    },
    '/reportes/{id}/descargar': {
      get: {
        tags: ['Reportes'],
        summary: 'Descargar archivo de reporte generado',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Archivo binario del reporte' },
        },
      },
    },

    '/clientes': {
      get: {
        tags: ['Servicios'],
        summary: 'Listar clientes activos',
        responses: {
          200: { description: 'Lista de clientes' },
        },
      },
    },
    '/sedes': {
      get: {
        tags: ['Turnos'],
        summary: 'Listar sedes activas',
        responses: {
          200: { description: 'Lista de sedes' },
        },
      },
    },
    '/tipos-incidencia': {
      get: {
        tags: ['Incidencias'],
        summary: 'Listar tipos de incidencias activas',
        responses: {
          200: { description: 'Lista de tipos' },
        },
      },
    },
  },
};

module.exports = swaggerDocument;

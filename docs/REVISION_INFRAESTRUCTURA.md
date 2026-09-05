# Revisión de infraestructura y conectividad

## Estado confirmado

- Supabase `vxqxbjkttymgvyskzheu`: activo y saludable.
- PostgreSQL 17.6, región São Paulo.
- 43 tablas operacionales con RLS habilitado.
- No existe rama Supabase de desarrollo; no se aplicaron cambios a la base principal.
- El ZIP anterior no consumía esa infraestructura: operaba con estado local y roles simulados.

## Correcciones incorporadas al código

- Autenticación SSR y sesiones por cookie.
- Perfil individual desde `user_profiles` y navegación real por rol.
- Acceso de supervisora limitado por instalaciones asignadas y RLS.
- Carga paralela de indicadores para evitar cascadas de consultas.
- Derivación de OC a proveedor, tarea financiera y copia a usuarios de Finanzas.
- Motor central de correo por cola con evento/módulo, reintentos e idempotencia.
- Activos originales ALEMSI integrados sin redibujar.
- Migración de inventario por movimientos, cierre de campaña e índices preparada, no aplicada.

## Riesgos hallados en la base vigente

- La vista `installation_material_profiles` requiere `security_invoker=true`.
- Funciones de arranque y perfil Excel con `SECURITY DEFINER` tienen ejecución demasiado amplia.
- Existen políticas RLS permisivas duplicadas, lo que aumenta trabajo por consulta.
- Existen claves foráneas operacionales sin índice y un índice único duplicado.

Las correcciones no destructivas principales están en la migración de desarrollo. La consolidación de políticas duplicadas debe probarse primero con usuarios de cada rol antes de aplicarse.

## Riesgo de dependencias

Next.js 15.5.25 compila correctamente. `npm audit` conserva avisos transitivos de PostCSS cuya solución propuesta exige migrar a Next.js 16. No se forzó ese salto mayor dentro de esta entrega; debe abordarse en una rama técnica separada con pruebas de autenticación y rutas.

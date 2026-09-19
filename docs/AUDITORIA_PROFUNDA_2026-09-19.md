# AUDITORÍA PROFUNDA FUNCIONAL Y TÉCNICA — ALEMSI Materiales

Fecha: 2026-09-19
Rama auditada: `recovery/estable-login-9c0a88a`

## 1. Propósito
Inventariar antes de rediseñar o limpiar. Clasificación: CONECTADA, PARCIAL, DESCONECTADA, PLANEADA, DUPLICADA, LEGACY, REVISAR, CANDIDATA A ELIMINAR, PROTEGIDA. XYZ: X=carga de pantalla, Y=consulta interna, Z=acción/guardado.

## 2. Circuito operativo vigente
`Perfil de materiales → Campaña → Levantamiento → Carencia → Consolidado → Abastecimiento → OC → Recepción/Factura → Cotejo → Inventario → Despacho → Ruta → Guía → Entrega → Pendientes → Histórico/Costos → Finanzas/Reportes`.

## 3. Inventario funcional resumido
| Área | Funciones encontradas | Estado | Riesgo / observación |
|---|---|---|---|
| Maestros materiales | crear/configurar material, proveedores, precios, CSV, catálogo | CONECTADA | XYZ incompleto; varias esperas aún no usan overlay corporativo |
| Clientes/contratos | cliente, contrato, instalación, presupuesto, catálogo cliente | CONECTADA | dos vías de presupuesto (`updateContractBudget` y `saveContractBudget`) requieren cotejo para evitar UX duplicada |
| Matriz Material × Instalación | cargar matriz, autorizar por instalación, guardar fila, perfil individual | CONECTADA | visual horizontal difícil; X/Y/Z incompleto; conservar lógica |
| Campañas | crear, bloquear instalación en campaña abierta, justificar, cerrar, borrar controladamente | CONECTADA/PROTEGIDA | `createRegionalCampaign` devuelve silenciosamente si rol no autorizado: debe revisarse manejo de error |
| Levantamientos | toma autenticada, token público, carencia, confirmación, trazabilidad | CONECTADA | Supervisora no recibe correctamente universo por asignación en selector principal; token usa service role y requiere mantener validaciones estrictas |
| Abastecimiento | consolidado, asignaciones, proveedor, generación OC | CONECTADA | regla ceil de OC vigente; presupuesto debe ser solo alerta |
| OC | OC desde abastecimiento, OC libre, derivación Finanzas, email | CONECTADA | OC libre no modifica necesidad/inventario por diseño; permisos dispersos por rol hardcodeado |
| Recepción | OC/documento, líneas recibidas, flete, pendiente cotejo | CONECTADA | descubrimiento de OC con saldo debe mejorar; recepción no debe confundirse con cotejo financiero |
| Cotejo/Factura | compra sin OC, cotejo documento, diferencias, posteo inventario | CONECTADA | posteo a inventario ocurre en cotejo; separar claramente responsabilidad Bodega/Finanzas |
| Inventario | movimientos reales y ajuste por conteo físico | CONECTADA/PROTEGIDA | Gerencia puede ajustar inventario hoy; revisar si corresponde operativamente |
| Despacho | sugerencias, generar despacho, extraordinario, preparar | CONECTADA | loaders y responsive en auditoría; datos actuales operacionales son pruebas |
| Rutas | crear, ordenar, preparar, iniciar, entregar, completar | CONECTADA EN CORRECCIÓN | duplicados históricos de prueba; nueva revalidación servidor evita doble asociación activa |
| Guía/Entrega | guía imprimible, firma/datos receptor, parcial, complementaria, email | CONECTADA | revalidar circuito móvil y pendiente parcial |
| Finanzas | compras, OC, facturas/recepciones, presupuestos, reportes base | PARCIAL | gran volumen de datos se carga en una API; permisos de GET solo comprueban usuario activo, no rol específico |
| Usuarios | crear/editar/desactivar, clave temporal | CONECTADA | solo Admin Total administra; Gerencia solicitada por negocio aún no conectada |
| Permisos | `user_module_permissions`, `user_scope_access`, `user_installation_access` existen en BD | PARCIAL/DESCONECTADA UI | arquitectura de permisos ya existe parcialmente; UI principal sigue usando `roleModules` hardcodeado |
| Auditoría | `activity_log` y vista reciente | CONECTADA | no todas las escrituras críticas verificadas una a una en esta pasada |
| Respaldos | ZIP CSV/JSON con clave servidor | CONECTADA/PROTEGIDA | solo Admin Total; mantener fuera de permisos delegables ordinarios |
| Preview perfiles | cambio real de sesión para probar perfiles | PARCIAL / RIESGO TÉCNICO | usa `SUPABASE_SECRET_KEY` obsoleta, contradice decisión vigente `SUPABASE_SERVICE_ROLE_KEY`; además omite Operaciones en opciones |

## 4. Hallazgos de permisos y seguridad
1. La navegación usa `roleModules` hardcodeado en `OperationalApp.tsx`, mientras la base ya posee `user_module_permissions` y `user_scope_access`. Hay dos modelos de autorización que hoy no están unificados.
2. `user-actions.ts` no incluye `Operaciones` en `USER_ROLES`, aunque Operaciones es séptimo rol oficial y sí aparece en navegación. Esto impide administrarlo coherentemente desde Usuarios.
3. Administración de usuarios está restringida en servidor a Admin Total. La capacidad solicitada para Gerencia todavía no existe y no debe habilitarse solo ocultando/mostrando UI.
4. `preview-profile-actions.ts` usa la variable obsoleta `SUPABASE_SECRET_KEY` y su lista de perfiles no incluye Operaciones. Es deuda técnica concreta y contradice DECISIONES.md.
5. Varias API GET (ej. Finanzas/Inventario) validan sesión/perfil activo pero delegan el alcance de datos a RLS; debe auditarse que las políticas RLS coincidan con la futura matriz de permisos antes de ampliar funciones configurables.
6. El endpoint público de conteo usa service role intencionalmente para token público; su seguridad depende de hash, expiración, uso único, campaña abierta y pertenencia instalación/campaña. Mantener estas defensas y no trasladar service role al cliente.
7. Permisos funcionales están dispersos en arrays de roles dentro de Server Actions. La futura matriz no puede limitarse a `roleModules`; requiere una capa única de autorización reutilizable en servidor.

## 5. Hallazgos de arquitectura y código
- `OperationalApp.tsx` funciona como orquestador monolítico por estado `tab`; esto explica navegación sin URL/contexto y obliga a retroceder/reseleccionar información.
- Existen páginas reales para OC, guía y consolidado de ruta, pero el resto de módulos vive mayormente dentro de la pantalla raíz. La migración a navegación contextual debe ser incremental.
- `Common.tsx`, `materiales-domain.ts` y `materiales-store.ts` son claramente del modelo heredado por su semántica y comentarios, pero NO se borran aún. La búsqueda del índice de la rama no es suficiente para certificar ausencia de referencias; antes de eliminar se debe hacer búsqueda exhaustiva sobre el árbol/aliases y build.
- `materiales-domain.ts` define solo 6 roles y estados antiguos; `materiales-store.ts` conserva estado local heredado y `visibleModules` distinto del sistema actual. Son candidatos fuertes a legacy si se confirma ausencia de imports.
- Hay documentación histórica (`MODULE_CONNECTION_AUDIT.md`) que describe una rama/roleModules anteriores; debe conservarse como antecedente, no tratarse como estado vigente.

## 6. Auditoría XYZ y visual
La regla objetivo es: operación real inicia → rombos ALEMSI visibles inmediatamente → bloqueo de repetición cuando aplica → respuesta → loader desaparece → resultado queda visible. Se encontraron loaders corregidos en Login/OC/Inventario/Recepción/Finanzas/Rutas y todavía quedan puntos por completar en Materiales, matriz, importadores, proveedores, usuarios, Preview de perfiles y otras acciones async. Las cargas de pantalla/sección deben usar overlay centrado en viewport; las acciones puntuales deben usar loader en botón.

Problemas visuales confirmados: encabezados y filtros pueden desplazar la operación bajo el viewport; matriz Material × Instalación requiere estrategia desktop/móvil; tablas anchas necesitan contenedor propio; navegación actual pierde contexto; resultados/formularios abiertos debajo del punto visible requieren foco/scroll controlado.

## 7. Cotejo logístico y navegación objetivo
No diseñar la navegación por componentes técnicos. Diseñarla por continuidad del trabajo y permisos. Cada registro debe conservar Cliente → Contrato → Campaña → Instalación y ofrecer siguiente paso autorizado. Ejemplo: Levantamiento confirmado → Carencia/Consolidado → Abastecimiento → OC → Recepción → Cotejo → Inventario → Despacho → Ruta → Entrega → Pendiente/Cierre. Las rutas completadas salen de trabajo activo y pasan a histórico.

La navegación debe permitir: siguiente paso natural; volver al nivel inmediatamente anterior; salto directo a módulos autorizados; mantener filtros/contexto; nunca obligar a volver dos pantallas para terminar el mismo circuito.

## 8. Matriz de permisos futura
Separar tres conceptos: **rol base**, **función autorizada** y **alcance de datos**. La base ya contiene tablas para módulos y alcance; antes de modificar esquema hay que reutilizar y validar esas estructuras. Ejemplos de capacidades a modelar desde funciones reales: generar/cotejar levantamiento, consolidar, generar/derivar OC, recibir, cotejar factura, ajustar inventario, generar guía, asignar/preparar/iniciar ruta, registrar entrega, resolver pendientes, administrar usuarios, auditoría y respaldos.

Respaldos y administración crítica deben permanecer protegidos hasta decisión explícita. Todo permiso de UI debe tener la misma revalidación en servidor.

## 9. Orden seguro de saneamiento
1. Terminar inventario de referencias/imports y funciones async.
2. Clasificar cada pieza: protegida/conectada/parcial/legacy/duplicada/candidata.
3. Validar utilidad operacional y dependencia de datos.
4. Corregir primero contradicciones de seguridad/configuración.
5. Limpiar datos operacionales de prueba por dependencias, nunca maestros.
6. Eliminar código solo después de búsqueda de referencias y build limpio.
7. Un commit por tarea y STATE.md en el mismo commit.

## 10. Próximas decisiones antes de implementar
- Definir si Gerencia puede **administrar usuarios/permisos** o solo asignar permisos funcionales/alcances a usuarios existentes.
- Determinar qué capacidades son delegables y cuáles quedan exclusivas de Admin Total.
- Cotejar RLS con `user_module_permissions` y `user_scope_access` antes de activar la matriz configurable.
- Completar XYZ antes de declarar estabilizada la interfaz.
- Diseñar mapa de navegación después del inventario/cotejo, no antes.

# STATE — ALEMSI Materiales
## Estado actual
- **Rama activa:** feature/rediseno-shell-navegacion
- **Último cambio:** feedback inmediato de botones + galería inferior de comprobantes en Rendiciones.
- **Fecha:** 2026-09-21

## Última tarea completada
- Solo Rendiciones fue modificada.
- Admin Total, Finanzas y Gerencia comparten la visual completa de bandeja general.
- Los demás usuarios ven Nueva rendición + Mis rendiciones y solo sus registros.
- Cada línea abre /rendiciones/[id]; no se expande dentro de la bandeja.
- El expediente conserva comprobante, Gemini, autocompletado, edición, suma, envío y revisión.
- Gerencia conserva permisos actuales: puede observar; no aprobar/rechazar/pagar.
- Finanzas/Admin Total conservan aprobación/rechazo y pago según reglas actuales.
- Sin cambios de Supabase, esquema, Gemini, API, variables Vercel ni otros módulos.

## Siguiente paso
- Validar Preview en escritorio y Android.
- Probar usuario común y perfiles Admin Total/Finanzas/Gerencia.

## Pendientes conocidos
- [ ] Validación UX escritorio/Android.
- [ ] Circuito completo de observación y correo.
- [ ] Confirmar INACTIVO/DEMO/ACTIVO.
- [ ] Historial básico y saldo anterior por RUT.

## Circuitos que no deben alterarse
1. Campaña: bloqueo de instalación en campaña activa.
2. Carencia = máximo autorizado − remanente.
3. Presupuesto alerta, nunca bloquea.
4. Recepción → Inventario → Despacho → Entrega.
5. Respaldos solo Admin Total.
6. Roles oficiales se mantienen.

## Ajuste visual 2026-09-21
- Indicadores de estado ahora usan colores contrastados de la paleta ALEMSI; error/rechazo conserva rojo funcional.
- Botones de Rendiciones pasan de píldora a rectangulares con radio moderado y borde visible.
- Ver comprobante, Volver y acciones secundarias se diferencian del fondo mediante borde teal y fondo claro.
- Sin cambios de lógica, permisos, Supabase, Gemini ni variables Vercel.

## Ajuste Rendiciones 2026-09-22
- La lista de gastos permanece arriba con su detalle operativo.
- Los comprobantes se muestran juntos en una galería inferior; las imágenes se amplían en pantalla y los PDF conservan apertura directa.
- Las acciones de Rendiciones muestran texto de proceso (Guardando…, Enviando…, Aprobando…, etc.) y se bloquean mientras ejecutan para evitar doble clic.
- No se usa spinner/rombo en estos botones.
- Sin cambios de esquema Supabase, Gemini, permisos ni variables Vercel.

## Corrección build 2026-09-22
- Corregido cierre JSX faltante en el bloque condicional de la galería de comprobantes de `/rendiciones/[id]`.
- Cambio sintáctico únicamente; no modifica lógica, permisos, Supabase ni Gemini.

## Permisos Rendiciones 2026-09-22
- Rendiciones integrado a CAPABILITIES y `user_module_permissions` sin cambio de esquema.
- Capacidades: enviar, revisar, observar, aprobar/rechazar y registrar pago.
- Finanzas y Gerencia ya no se excluyen de navegación cuando tienen acceso al servicio.
- Server Actions validan rol base + excepción individual; Admin Total permanece protegido.
- Gerencia hereda revisar/observar; Finanzas hereda revisar/observar/aprobar/pagar.

## Borrador persistente de Rendiciones 2026-09-22
- Una rendición recién creada queda en Borrador y abre inmediatamente su expediente.
- Cada gasto se persiste al pulsar “Agregar gasto”; el usuario puede salir y continuar después sin perder líneas ya guardadas.
- El comprobante es opcional: se permite foto/PDF con lectura automática o ingreso manual del gasto.
- Solo el creador puede agregar/editar gastos y enviar su rendición.
- Finanzas/Gerencia no ven ni pueden abrir borradores ajenos; la rendición entra a revisión solo al cambiar a Enviada mediante “Enviar a Finanzas”.
- No hay cambios de esquema Supabase ni variables Vercel.

## Optimización y correlación visual de comprobantes 2026-09-22
- Fotos se optimizan en el navegador antes de lectura y guardado: máximo 1200 px, WebP y objetivo aproximado de 100 KB.
- El original pesado no se envía al Server Action ni se almacena en Supabase, evitando el error 413 (>1 MB) detectado en Android.
- Lista: Gasto 1, Gasto 2, etc. Galería: Foto 1 · Gasto 1, Foto 2 · Gasto 2, etc.
- Sin cambios de esquema Supabase ni variables Vercel.

## Corrección visibilidad de borradores propios 2026-09-22
- Un usuario con capacidad de revisión también puede ver sus propios Borradores en la bandeja de Rendiciones.
- Los Borradores de otros usuarios continúan ocultos hasta Enviar a Finanzas.
- Pendientes de Finanzas cuenta únicamente rendiciones Enviadas; Observadas quedan fuera de la cola activa mientras se corrigen.

## Eliminación de gastos duplicados 2026-09-22
- El creador puede eliminar líneas mientras la rendición esté Borrador u Observada.
- Eliminar una línea también elimina su comprobante de Storage/documentos y recalcula total_presented.
- La acción se registra en activity_log y no está disponible después de enviar/aprobar/pagar.

## Separación Mis rendiciones / Rendiciones del personal 2026-09-22
- Perfiles con capacidad de revisión ven dos bandejas separadas: Mis rendiciones y Rendiciones del personal.
- Mis rendiciones contiene exclusivamente registros creados por el usuario, incluidos Borradores y Observadas.
- Rendiciones del personal excluye al usuario conectado y oculta Borradores ajenos; aparecen al entrar al circuito de revisión.
- Se bloqueó en interfaz y servidor revisar/aprobar/rechazar gastos propios y registrar el pago de una rendición propia.
- Sin cambios de esquema Supabase ni variables Vercel.

## Compactación visual expediente de Rendiciones 2026-09-22
- Se redujo el alto de cada línea de gasto en escritorio para aprovechar mejor la pantalla de revisión.
- Los seis datos del gasto se distribuyen en una sola fila y el bloque Observación/Monto/acciones queda en una fila compacta inmediatamente inferior.
- No cambia lógica, permisos, montos, estados, Supabase ni variables Vercel.

## Densidad de tabla Rendiciones 2026-09-22
- Se mantienen las columnas y datos actuales del expediente; no se elimina información.
- En escritorio se amplía el ancho útil y se reducen padding, gaps, alto de controles y márgenes para evitar crecimiento vertical innecesario.
- Observación, monto autorizado y acciones permanecen compactos bajo cada línea solo cuando corresponde revisar.
- Móvil conserva el diseño responsive existente.
- Sin cambios de lógica, Supabase, permisos ni variables Vercel.

## Matriz compacta de gastos según Excel 2026-09-22
- El expediente usa exactamente el orden visual solicitado: ITEM | TIPO | Fecha | T. DOC | N. DOC | RAZÓN SOCIAL | Descripción | MONTO | OBSERVACIÓN | APROBAR | OBS | RECHAZA.
- T. DOC corresponde al tipo de documento y N. DOC al número del documento.
- En escritorio cada gasto ocupa una fila compacta; observación y acciones de revisión se integran en la misma matriz.
- Se conserva monto autorizado dentro de la celda de observación para no perder la función financiera existente.
- Edición/eliminación del creador permanecen disponibles bajo su fila mientras Borrador/Observada.
- Móvil redistribuye los mismos datos con sus mismos nombres.
- Sin cambios de esquema Supabase, permisos ni variables Vercel.

## Eliminación de información repetida en expediente 2026-09-22
- El bloque superior se denomina “Gastos”; “Comprobantes” queda reservado a la galería inferior.
- Se elimina el contador textual redundante de gastos porque ITEM ya enumera cada línea.
- Las miniaturas dejan de repetir tipo/número de documento, monto y estado ya visibles en la matriz; conservan solo la correlación Foto N · Gasto N.
- La galería de escritorio pasa a franja horizontal compacta para reducir scroll vertical.
- Se conserva el estado general de la rendición y el estado por línea porque representan niveles distintos del flujo.
- Sin cambios de lógica, Supabase, permisos ni variables Vercel.

## Fórmula financiera y arrastre de saldos 2026-09-22
- Fórmula única: saldo de cierre = saldo anterior + total autorizado − fondos/caja chica − pagado.
- Saldo positivo = monto pendiente a favor de quien rinde; saldo negativo = monto a favor de la empresa.
- Los fondos/caja chica se descuentan antes de determinar el pago.
- El pago permitido corresponde exactamente al saldo a favor de quien rinde, no al total autorizado bruto.
- Si el resultado al aprobar es cero o queda a favor de la empresa, la rendición se cierra sin desembolso y conserva el saldo negativo para arrastre.
- Una nueva rendición recupera el saldo de cierre de la última rendición Pagada del mismo RUT; no se arrastran rendiciones aún abiertas para evitar doble contabilización.
- La pantalla muestra Saldo a pagar y A favor empresa por separado.
- Comprobantes se correlacionan únicamente como ITEM N, sin repetir monto/estado/tipo de documento.
- Se confirmó en Supabase que previous_balance admite valores con signo y que renditions_check solo valida period_end >= period_start; no fue necesario cambiar esquema.
- Sin variables nuevas de Vercel.

## Regla de caja chica individual y dashboard gerencial 2026-09-22
- Los fondos/caja chica y sus saldos son individuales por persona/RUT; nunca se compensan entre trabajadores.
- Los totales agregados de fondos se usan solo como indicador informativo para Gerencia/Finanzas.
- Se incorpora Dashboard de gastos para perfiles con capacidad de revisión: Admin Total, Gerencia y Finanzas según permisos.
- Los gráficos usan monto autorizado y solo rendiciones Aprobadas/Pagadas.
- Visualizaciones: gastos por tipo, gastos por persona y evolución mensual; indicadores de Presentado, Autorizado y Fondos/Caja chica.
- El dashboard consume renditions y rendition_expenses existentes; no duplica datos ni cambia el esquema Supabase.
- Sin variables nuevas de Vercel.

## Corrección visual literal expuesto 2026-09-22
- Corregido el texto literal \\n que quedó renderizado entre el encabezado y Nueva rendición por una inserción JSX incorrecta del dashboard.
- Corrección exclusivamente sintáctica/visual; no modifica datos, permisos, fórmulas, Supabase ni dashboard.
- Sin variables nuevas de Vercel.

## Acceso financiero y exportación Excel 2026-09-22
- Dashboard, bandeja del personal y exportación global quedan restringidos exclusivamente a perfiles Gerencia y Finanzas.
- Los demás perfiles consultan únicamente sus propias rendiciones; no reciben vista global ni dashboard.
- Finanzas conserva aprobación/rechazo y registro de pago; Gerencia conserva revisión/observación según permisos.
- El Excel mantiene primero el orden original ITEM | TIPO | Fecha | T. DOC | N. DOC | RAZÓN SOCIAL | Descripción | MONTO | OBSERVACIÓN | APROBAR | OBS | RECHAZA.
- Después agrega trazabilidad: N° rendición, RUT y nombre de quien rinde, motivo, montos de rendición/autorizado, período, estado, fecha de envío, fecha/hora de aprobación, quién aprobó/revisó, revisión por ITEM, fondos/caja chica, saldo anterior, monto/fecha/hora de pago, quién registró pago, referencia documental de pago y observación de pago.
- El archivo se genera como .xlsx con encabezado congelado y autofiltro; excluye Borradores ajenos/no ingresados al circuito.
- La caja chica continúa siendo individual por persona/RUT; los agregados son solo indicadores gerenciales.
- Sin cambios de esquema Supabase ni variables nuevas de Vercel.

## Corrección build exportación Excel 2026-09-22
- Corregido tipado de IDs de usuarios y cuerpo binario de respuesta del endpoint XLSX para compatibilidad TypeScript/Next 15.
- No cambia el contenido ni los permisos de la exportación.

## Corrección guardado monto autorizado por línea 2026-09-22
- Finanzas puede corregir y guardar el monto autorizado de una línea ya Aprobada mientras la rendición esté Enviada o Aprobada.
- Guardar monto actualiza rendition_expenses.authorized_amount, recalcula renditions.total_authorized y refresca el expediente.
- Se mantiene el límite duro: monto autorizado nunca supera monto presentado.
- Gerencia no modifica montos; conserva revisión/observación. No se habilita edición financiera a otros perfiles.
- La modificación queda registrada en activity_log con monto de línea y total autorizado recalculado.
- Sin cambios de esquema Supabase ni variables Vercel.

## Resumen mensual y búsqueda histórica 2026-09-22
- Dashboard de Gerencia/Finanzas abre por defecto en el mes calendario actual.
- Selector Mes del resumen permite buscar cualquier mes/año anterior; indicadores y gráficos cambian únicamente al período seleccionado.
- La descarga Excel permanece independiente del filtro visual y siempre exporta el histórico completo disponible.
- El botón se identifica como Descargar Excel histórico completo para evitar confusión.
- Gastos por persona se identifican por nombre + RUT; la evolución usa fecha real del gasto cuando existe.
- Sin cambios de esquema Supabase ni variables Vercel.


## Rediseño UX/UI controlado · Fase 3 — Shell y navegación 2026-09-22
- Nueva rama: `feature/rediseno-shell-navegacion`, creada desde `ui/rendiciones-corporativa`; `main` no se modificó.
- Menú plano agrupado visualmente en cuatro workspaces: INICIO, ABASTECIMIENTO, BODEGA Y LOGÍSTICA y FINANZAS Y ADMIN.
- Se preservan los módulos efectivos ya calculados por rol/permisos/servicios; el workspace solo agrupa opciones visibles y no concede permisos.
- Los tabs conservan sus identificadores y `setTab(...)`; Campaña → Levantamiento mantiene selectedCampaignId y selectedSurveyInstallationId.
- Iconografía pasa de `.nav:nth-of-type(...)` a `data-tab="..."`.
- En móvil <=760 px la barra horizontal se reemplaza por Drawer lateral ligero sin dependencias nuevas.
- Las rutas dedicadas permanecen intactas en esta tarea.
- Sin cambios de Supabase, esquema, reglas de negocio, package.json ni variables Vercel.
- `npm run build` y `npx tsc --noEmit`: no ejecutados localmente porque esta sesión solo dispone del conector GitHub, no de un terminal del repositorio. Validar Preview Vercel antes de fusionar.

## Siguiente paso del rediseño
- Validar Preview con los 7 roles reales en escritorio y Android.
- Verificar workspaces vacíos, acceso a Rendiciones, Campaña → Levantamiento y Drawer móvil.
- No integrar rutas dedicadas al Shell común hasta aprobar esta implementación.


## Hotfix de compilación · 2026-09-22
- Se localizó el fallo de build en `src/app/responsive-fixes.css`: el reemplazo textual interpretó la secuencia `
- Se reconstruyó únicamente `responsive-fixes.css` desde la versión estable de `ui/rendiciones-corporativa` y se reaplicaron los selectores `data-tab` + estilos del Drawer usando sustitución literal segura. Se verificó balance de llaves CSS y ausencia de selectores `nth-of-type`.
- No se modificó `OperationalApp.tsx`, package.json, Supabase, reglas de negocio ni rutas.
- Siguiente validación: confirmar deployment Vercel READY y retomar certificación Fase 4.
` del icono de Finanzas como patrón de sustitución, truncando y duplicando parte del CSS.
- Se reconstruyó únicamente `responsive-fixes.css` desde la versión estable de `ui/rendiciones-corporativa` y se reaplicaron los selectores `data-tab` + estilos del Drawer de Fase 3.
- No se modificó `OperationalApp.tsx`, package.json, Supabase, reglas de negocio ni rutas.
- Siguiente validación: confirmar deployment Vercel READY y retomar certificación Fase 4.


## Rediseño UX/UI controlado · Fase 4.1 — Certificación de perfiles 2026-09-22
- PreviewProfileSwitcher separa Admin y Operaciones como perfiles de prueba independientes.
- preview-profile-actions permite conmutar explícitamente a Operaciones en Preview; no se modificó authorization.ts ni las capacidades productivas.
- Los 7 perfiles certificables quedan: Admin Total, Gerencia, Admin, Operaciones, Finanzas, Bodega y Supervisora.
- La agrupación de Workspaces continúa derivándose de los módulos efectivos; los Workspaces sin módulos visibles se filtran antes de renderizar.
- Pendiente de cierre: confirmar deployment READY y validación interactiva del Drawer móvil y de cada sesión real mediante PreviewProfileSwitcher.


## Compactación UX/UI operativa · 2026-09-22
- Levantamientos: en escritorio, datos de instalación + acceso por correo + acciones de acceso + Hacer levantamiento quedan en una sola fila horizontal.
- SurveyLinkControl conserva createSurveyAccessLink, estados, generación, envío y copia; solo cambia su presentación.
- Campañas: métricas Esperadas / En proceso / Tomadas / Pendientes pasan a chips compactos y comparten cabecera con Abrir campaña y Administrar campaña.
- Inicio: el circuito operativo conserva los 13 pasos reales existentes y se compacta para caber en una sola línea en escritorio; no se eliminaron etapas para forzarlo a 11.
- Móvil mantiene redistribución legible y controles táctiles; no se alteraron selectedCampaignId, selectedSurveyInstallationId, setTab, Server Actions ni Supabase.
- Sin dependencias nuevas ni variables Vercel.


## Tabla densa de Levantamientos y accesos colapsados · 2026-09-22
- Las instalaciones abiertas desde Campañas pasan de tarjetas altas a una matriz densa con columnas Cliente | Contrato | Instalación | Estado | Acción | Accesos.
- El acceso por correo queda oculto por defecto detrás de “✉ Enviar link”; al desplegar conserva correo, Generar acceso, Enviar por correo, Copiar link y mensajes del mismo createSurveyAccessLink.
- La acción principal permanece siempre visible: Hacer levantamiento; en tomas completadas se identifica como Ver / editar conteo.
- Las seis métricas de Inicio reducen padding, altura y tipografía numérica para disminuir aproximadamente a la mitad su ocupación vertical.
- Móvil conserva lectura responsive: las filas densas se redistribuyen y el panel de acceso aparece como panel compacto inferior.
- Sin cambios de Supabase, Server Actions, estados React, permisos, package.json ni variables Vercel.


## Dashboard gerencial de Inicio · 2026-09-22
- Inicio reemplaza las seis tarjetas operativas y la Base operativa grande por Control gerencial de materiales.
- Fuente real: contracts.net_budget para presupuesto; purchase_orders.total_net vinculadas por supply_runs.contract_id para consumo/compromiso por contrato.
- Indicadores: presupuesto configurado, comprometido en OC, saldo, porcentaje consumido, OC en curso, recepciones parciales, campañas activas y consumo por contrato.
- Los contratos sin net_budget permanecen visibles como “Presupuesto no configurado”; no se excluyen ni bloquean campañas/OC.
- Base operativa queda reducida a una línea secundaria con clientes, instalaciones y materiales.
- No se cambió esquema Supabase, autorización, Server Actions, estados React, package.json ni variables Vercel.

- Hotfix build Dashboard Inicio: se agregó el tipo MaterialControlData y la prop materialControl a Props; sin cambios funcionales ni de datos.

## Simplificación de Inicio · 2026-09-22
- Se eliminó del Inicio la franja visual del circuito Perfil → Campaña → … → Entrega. El flujo sigue intacto en los módulos; solo se retira una explicación redundante que ocupaba espacio antes del Dashboard gerencial.
- También se retiraron la constante stages y el useMemo/cards ya sin uso en OperationalApp.
- Sin cambios de lógica de negocio, Supabase, navegación, permisos ni variables Vercel.

- Hotfix: se restauró import useMemo, requerido por ConsolidatedSupply y SurveyEditor dentro de OperationalApp; el retiro del Stepper no cambia esos usos.

## Dashboard por rol · Supervisora · 2026-09-22
- Inicio de Supervisora deja de mostrar presupuesto/OC globales y pasa a “Mi operación”.
- Fuentes existentes, sin esquema nuevo: user_installation_access(can_survey), campaign_installations(supervisor_id/installation_id/status), campaigns(status), delivery_routes(delivery_assignee_id/status) y delivery_route_dispatches.
- Muestra campañas activas relacionadas, levantamientos pendientes/completados y rutas asignadas pendientes/en ejecución.
- Hacer levantamiento reutiliza selectedCampaignId + selectedSurveyInstallationId + setTab("levantamientos"); rutas llevan al módulo Despacho.
- El dashboard no concede permisos nuevos: resume relaciones/asignaciones ya existentes.
- Sin cambios de esquema Supabase, authorization.ts, package.json ni variables Vercel.

- Hotfix build Dashboard Supervisora: se eliminó la referencia anticipada a userInstallationAccess dentro de Promise.all. Las instalaciones autorizadas se filtran después de resolver las consultas, preservando la misma regla de alcance.

## Alcance territorial y asignación masiva · 2026-09-22
- Autorizado explícitamente el cambio mínimo de esquema para que “Toda la Región” incluya instalaciones presentes y futuras.
- Nueva tabla user_territorial_scopes: user_id + region + commune opcional + active; RLS permite lectura propia/gerencial y escritura Admin Total.
- Usuarios y perfiles incorpora filtros Región/Comuna, “Asignar toda la región/comuna”, chips de alcances activos, selección de todas las visibles y asignación masiva.
- Selección específica conserva user_installation_access; alcance territorial complementa, no reemplaza, las asignaciones individuales.
- Inicio/Campañas/Levantamientos y Despacho de Supervisora consideran instalación individual O alcance territorial; no se modifica authorization.ts ni la matriz de roles.
- Las instalaciones futuras quedan incluidas automáticamente por coincidencia region/commune, sin crear 150 registros individuales.
- Sin variables nuevas de Vercel.

- Hotfix build: se alineó Promise.all de page.tsx agregando la consulta user_territorial_scopes en la misma posición de su destructuración; evita desplazamiento de resultados posteriores.

## Corrección visual Supervisora y acceso Rendiciones · 2026-09-22
- Dashboard de Supervisora deja de imprimir el JSON interno de campaigns.label y muestra únicamente el nombre legible de la campaña.
- El usuario activo “Operaciones” (rol técnico Admin) quedó autorizado para el servicio Rendiciones mediante additional_service_user_access; no se cambió su rol ni authorization.ts.
- Sin cambios de esquema, reglas de negocio ni variables Vercel.

## Inicio Supervisora jerárquico · 2026-09-22
- Se reemplazan las cuatro tarjetas separadas y la lista inmediata de instalaciones por dos bloques: “Campañas y levantamientos” y “Rutas y entregas”.
- Campañas y levantamientos combina campañas activas, total de levantamientos, pendientes y realizados en una sola tarjeta; los indicadores son accesos al módulo Levantamientos.
- Rutas y entregas resume rutas pendientes y cantidad de guías/despachos vinculados; abre directamente Despacho.
- Debajo se muestra “Mis campañas” como lista compacta agrupada por campaign_id con total, pendientes y realizados. Abrir una campaña cambia a Levantamientos sin desplegar instalaciones dentro de Inicio.
- Se conservan selectedCampaignId, selectedSurveyInstallationId y setTab; no se cambian Server Actions, Supabase, authorization.ts ni variables Vercel.

## Selector visual de campaña en Necesidades y abastecimiento · 2026-09-22
- OC desde campaña/consolidado deja de usar un select desplegable para elegir campaña.
- Se reutiliza el patrón de lista compacta usado en Inicio de Supervisora: una fila por campaña con nombre, instalaciones con conteo confirmado, líneas con necesidad y acción Abrir/Seleccionada.
- Al pulsar una fila se conserva exactamente el flujo existente: campaignId, familias, cantidades, precios, mensajes y detalle de origen; no se cambian Server Actions ni reglas de abastecimiento.
- El cambio aplica a todos los perfiles que ya tengan acceso al módulo Necesidades y abastecimiento; no modifica authorization.ts ni concede acceso nuevo.
- Sin cambios de Supabase, package.json ni variables Vercel.

## Estandarización de densidad de interfaz · 2026-09-22
- Escritorio: botones de contenido estandarizados a 32px de alto mínimo, padding 5x10, fuente 11px y radio 8px; inputs/selects a 34px. Paneles, tarjetas y filas reducen padding para mostrar más información útil por pantalla.
- Móvil <=760px mantiene tratamiento independiente: controles táctiles de mínimo 42px y campos de 44px, evitando trasladar la densidad de escritorio a teléfonos.
- La regla se limita a .portalMain y excluye navegación lateral, botón de menú y cierre del Drawer.
- No se modifican componentes funcionales, Server Actions, estados React, authorization.ts, Supabase ni dependencias.

## Correo manual al enviar OC · 2026-09-22
- En Órdenes de compra → Enviar OC, la casilla Destino queda editable para ingresar o corregir manualmente el correo antes del envío.
- Si el proveedor tiene purchase_order_email/commercial_email se usa solo como valor inicial editable; si no existe, el campo queda vacío.
- queuePurchaseOrderEmail recibe recipient_email, valida un destino básico y conserva la cola central, idempotencia, trazabilidad y políticas del entorno.
- No se modifica el correo maestro del proveedor, Supabase, authorization.ts ni variables Vercel.


## Inicio extensión FLOTA · 2026-09-23
- Nueva rama: `feature/flota-base`, creada desde `feature/rediseno-shell-navegacion`; `main` no fue modificado.
- Se creó la ruta dedicada `/flota` con experiencia responsive propia, moderna y orientada a tareas.
- Se creó `src/modules/flota/domain.ts` con tipos y reglas puras iniciales para estado, documentos, fotos obligatorias, alertas por fecha/kilometraje y rendimiento FULL→FULL.
- Flota queda explícitamente desacoplada de Materiales/Bodega: no consume sus indicadores, inventario, OC, contratos ni presupuesto.
- La ruta reutiliza únicamente autenticación/perfil existente. No se hicieron cambios de esquema Supabase ni variables Vercel.
- Alta de vehículos, persistencia, cámara/IA, retiro/devolución, combustible, GPS puntual, deterioros e informes permanecen deshabilitados hasta aprobar y crear el esquema propio de Flota.
- Siguiente paso: validar que `/flota` compile/despliegue en Preview y presentar esquema mínimo de datos Flota antes de cualquier migración Supabase.
- `npm run build` y `npx tsc --noEmit`: pendientes de CI/Preview; esta sesión opera mediante conector GitHub sin terminal del repositorio.


## Integración Flota con Servicios adicionales · 2026-09-23
- `/flota` reutiliza la arquitectura existente creada junto a Rendiciones/Cotizaciones: `additional_services`, `additional_service_user_access` y RPC `has_additional_service_access('flota')`.
- No se creó un segundo sistema de permisos ni activación.
- Servicio INACTIVO no permite abrir Flota; DEMO identifica visualmente el modo; ACTIVO abre la aplicación según acceso. Admin Total conserva administración del servicio, pero un servicio INACTIVO tampoco abre la ruta.
- Servicios adicionales muestra “Abrir Flota” cuando Flota no está INACTIVO.
- Cambiar estado/acceso de servicios revalida también `/flota`.
- Materiales/Bodega siguen sin dependencia funcional hacia Flota.
- Próximo bloque: esquema propio de persistencia de Flota (vehículos, documentos/versiones, usos, fotos, combustible, mantenciones, alertas/deterioros y configuración). Requiere autorización explícita antes de modificar Supabase.
- Build/tsc: pendientes de Preview/CI; no hay terminal del repositorio en esta sesión.


## Flota operativa base y persistencia · 2026-09-23
- Autorizado y aplicado en Supabase `alemsi-materiales` el migration `flota_operational_core_v1`.
- Tablas propias creadas: `fleet_vehicles`, `fleet_documents`, `fleet_assignments`, `fleet_locations`, `fleet_photos`, `fleet_fuel_entries`, `fleet_maintenance`, `fleet_deterioration_events`, `fleet_settings`.
- Todas las tablas Flota tienen RLS y dependen de `has_additional_service_access('flota')`; no se modificaron tablas de Materiales, Bodega ni Rendiciones.
- Se protege una sola asignación abierta por vehículo y una sola versión vigente por tipo de documento; las versiones históricas permanecen.
- Configuración inicial conserva 15/7 días, 750/500 km, 7 posiciones fotográficas, roles Gerencia/Finanzas/Operaciones, comparación visual y ubicación puntual.
- `/flota` ya lee vehículos reales desde Supabase; actualmente hay 0 vehículos.
- Admin Total puede registrar el primer vehículo desde la misma pantalla; patente duplicada queda bloqueada.
- Creado expediente `/flota/[id]` con las tres vistas acordadas: RESUMEN | DOCUMENTOS | HISTORIAL.
- Flota está actualmente configurada en `ACTIVO` y `ALL_AUTHENTICATED` en Servicios adicionales, tal como existe hoy en la base.
- Siguiente bloque: casos de uso guiados Tomar/Devolver vehículo, captura de 7 fotos y ubicación; después documentos/combustible/mantenciones.
- Build y `tsc --noEmit`: pendientes de Preview/CI porque esta sesión no dispone de terminal del repositorio.
- Variables Vercel nuevas: ninguna.


## Flota · toma y devolución base · 2026-09-23
- Implementado el caso de uso real Tomar vehículo / Devolver vehículo sobre `fleet_assignments`.
- La toma registra conductor desde la sesión, RUT ingresado, kilometraje inicial y observación opcional; revalida que el vehículo siga Disponible.
- La devolución registra kilometraje final, observación opcional y fecha/hora; impide kilometraje menor al inicial y devuelve el vehículo a Disponible.
- El expediente RESUMEN prioriza ahora una única acción principal según estado, con formulario compacto y táctil para móvil.
- El historial existente recibe automáticamente cada uso porque consume `fleet_assignments`.
- No se incorporaron todavía las 7 fotos ni ubicación dentro de la confirmación: deben implementarse como flujo guiado previo a confirmar, para no simular una inspección que aún no existe.
- Siguiente paso exacto: flujo guiado 7/7 + ubicación puntual en toma/devolución, preservando originales; después combustible y documentos.
- Sin cambios en Materiales/Bodega/Rendiciones ni variables Vercel.
- Build/tsc continúan pendientes de Preview/CI por ausencia de terminal del repositorio.


## Hotfix Flota · alta duplicada · 2026-09-23
- Detectado en Runtime de Vercel el error mostrado con digest 2123351204: POST /flota devolvía 500 porque se intentó registrar nuevamente la patente ya existente RBHJ56.
- La primera alta sí quedó persistida correctamente: RBHJ56 · MG 3 · Disponible · 146.998 km.
- Se mantiene el bloqueo de patente única; se corrigió únicamente la experiencia de error para que un duplicado vuelva a /flota con aviso visible y no provoque pantalla de excepción.
- El alta correcta también devuelve confirmación visible y un error genérico de persistencia se presenta sin exponer detalles internos.
- Siguiente validación: esperar deployment Preview de estos commits, recargar /flota y confirmar que aparece el vehículo ya registrado.
- Sin cambios de esquema, Materiales/Bodega/Rendiciones ni variables Vercel.


## Flota · garaje visual por fotografía · 2026-09-23
- La referencia visual aprobada pasa a ser criterio de interfaz real, no boceto: la portada de Flota muestra una grilla de vehículos basada en fotografías grandes.
- Toda la tarjeta/fotografía es botón y abre directamente `/flota/[id]`; se elimina la dependencia visual de “Ver expediente” como acción separada.
- Cada tarjeta muestra fotografía frontal, estado, patente, identificación/modelo y kilometraje.
- Se agregó `fleet_vehicles.cover_photo_path` para la miniatura identificadora. Es una referencia derivada; los originales de inspección permanecen inmutables en `fleet_photos`.
- Mientras un vehículo no tenga primera foto frontal, aparece un espacio explícito “FOTO FRONTAL · Se asignará en la primera inspección”; no se inventan imágenes.
- La siguiente implementación debe hacer que la primera captura Frontal del flujo 7/7 cree/asigne esta portada automáticamente y mantenga el original histórico.
- La interfaz mantiene responsive móvil: una tarjeta fotográfica por fila y acceso táctil sobre toda la tarjeta.
- Sin variables nuevas de Vercel ni dependencia con Materiales/Bodega.


## Flota · portada MG y vehículos editables · 2026-09-23
- Se utilizó la imagen entregada por el usuario como fuente visual y se incorporó el recorte del MG como activo inicial `/public/flota/rbhj56-mg.svg`; no se generó un vehículo alternativo.
- RBHJ56 quedó asociado en Supabase a `/flota/rbhj56-mg.svg` como portada inicial.
- La portada admite dos fuentes: activo inicial local o futura fotografía privada de inspección en Storage.
- Admin Total puede editar desde el expediente patente, identificación, marca, modelo, año y kilometraje; se conserva unicidad de patente.
- La fotografía de portada inicial no sustituye el futuro original 7/7. Cuando exista inspección, el original se guarda en `fleet_photos` y la portada puede apuntar a su miniatura sin perder evidencia.
- Próximo paso: cargador/cámara 7/7 y edición/cambio controlado de fotografía de portada.
- Sin variables nuevas de Vercel; Materiales/Bodega/Rendiciones no fueron modificados.


## Flota · datos básicos maestros · 2026-09-23
- Fuente entregada por usuario define 5 vehículos: LKDG49 Ford Escape Titanium AWD 2.0 AUT 2019; RBHJ56 MG 3 Hatch Back 1.5 AUT 2021; SPZJ40 Opel Vivaro TD 150 2.0 2023; SRYB45 JAC T8 DCAB 4X4 2.0 2023; TTHG24 Opel Combo L1 1.5 2025.
- Se agregaron campos maestros editables `vehicle_type` y `chassis_vin`.
- RBHJ56 existente fue corregido con la fuente: AUTOMOVIL · MG · 3 HATCH BACK 1.5 AUT · chasis/VIN 1S54C5TGM2220603 · año 2021. Se conserva kilometraje operativo 146.998 y portada MG.
- Los otros cuatro no se crean todavía con datos operativos inventados; al darlos de alta se usarán exactamente los datos maestros entregados y seguirán editables.
- Sin variables nuevas de Vercel.


## Flota · compactación visual del garaje · 2026-09-23
- Se trabajó directamente sobre la UI real de `/flota`; no se generó ni sustituyó el diseño por un boceto.
- En escritorio ancho (>=1180px), el garaje usa 6 columnas para permitir visualizar aproximadamente seis vehículos simultáneamente.
- Se redujeron altura/padding de indicadores, tipografías, espacios y metadatos de tarjetas sin eliminar información.
- La fotografía continúa siendo el botón completo de acceso al expediente.
- “Agregar nuevo vehículo” se compactó a la misma escala visual de las tarjetas y deja de ocupar un bloque desproporcionado.
- Tablet mantiene 3 columnas y móvil 1 columna táctil.
- Este cambio es solo visual; no modifica Supabase, lógica de Flota, permisos, Materiales/Bodega/Rendiciones ni variables Vercel.
- Pendiente separado: reemplazar la portada MG por una fuente/recorte de mayor resolución para eliminar pixelación sin alterar el layout.


## Flota · jerarquía cromática y accesos móviles · 2026-09-23
- Se mejoró directamente la visual real de Flota: fondo más limpio, teal corporativo más definido, estados Disponible/En uso/Fuera de servicio con jerarquía verde/ámbar/rojo, bordes y foco de tarjetas más claros.
- Se conserva la grilla compacta de 6 vehículos en escritorio y la fotografía como botón completo.
- El usuario solicita accesos directos de teléfono con sus iconos entregados para FLOTA, RENDICIÓN y RUTA.
- Los archivos entregados identificados en la conversación son flota_junto.png, rendicion_junto.png y materiales_junto (1).png; no deben regenerarse ni sustituirse por iconos inventados.
- No se implementa todavía un destino RUTA suponiendo una URL: antes debe verificarse la ruta real existente del proceso móvil de ruta/entrega.
- La configuración PWA debe preservar sesión/permisos y no crear una segunda autenticación.
- Sin cambios de Supabase ni variables Vercel.


## Hotfix build Flota · variables vehicle_type/chassis_vin · 2026-09-23
- Vercel Preview del commit 39bc74a compiló JavaScript pero falló en validación TypeScript en `src/app/flota/actions.ts:80`.
- Causa exacta: `updateVehicle` enviaba las propiedades abreviadas `vehicle_type` y `chassis_vin` sin declararlas previamente en el scope de la función.
- Corregido leyendo ambos campos desde FormData antes del update; VIN se normaliza a mayúsculas y ambos continúan opcionales/editables.
- Commit de corrección: `2ed2603b9d7bb13003fa738e45f2df0ed54dc1d7`.
- No cambia esquema Supabase, reglas de negocio, permisos ni variables Vercel.
- Validación pendiente: nuevo build de Vercel debe superar Linting and checking validity of types. `npm run build` y `npx tsc --noEmit` no se ejecutan localmente porque esta sesión no dispone de terminal del repositorio.


## Flota · carga inicial de los cinco vehículos · 2026-09-23
- Se completó el alta de los cinco vehículos maestros entregados por el usuario: LKDG49, RBHJ56, SPZJ40, SRYB45 y TTHG24.
- LKDG49 fue normalizado con los datos maestros entregados; SPZJ40, SRYB45 y TTHG24 fueron incorporados.
- RBHJ56 conserva su kilometraje real previamente registrado de 146.998 km.
- Los vehículos aún no completados por el usuario mantienen kilometraje inicial 0 como valor técnico pendiente del formulario actual; el usuario indicó que completará sus datos. No debe interpretarse 0 como lectura física confirmada.
- Todos quedan editables por Admin Total desde su expediente.
- No se alteraron Materiales/Bodega/Rendiciones ni variables Vercel.


## Flota · expediente documental y contrato de lector · 2026-09-23
- Autorizado por usuario y aplicada migración `flota_document_reader_fields_v1` sobre tablas propias de Flota.
- `fleet_documents` ahora separa `extracted_data` (propuesta del lector) de `confirmed_data` (dato humano confirmado), además de estado/confianza de lectura, patente/VIN documental y updated_at.
- Creado `src/modules/flota/document-reader.ts`: contrato dirigido por tipo para PADRON, REVISION_TECNICA, PERMISO_CIRCULACION, SOAP, SEGURO_AUTOMOTRIZ y MANTENCION.
- Cada plantilla define títulos/alias, zonas prioritarias, campos esperados y, para pólizas, términos específicos de grúa/remolque, auto de reemplazo, reparación en terreno, combustible, conductor, repuestos y asistencia legal.
- Expediente DOCUMENTOS incorpora alta/renovación, campos confirmables/editables y tabla de versión vigente; al renovar se conserva la versión anterior como histórica.
- Validación cruzada: patente/VIN documental distinto del vehículo marca el registro para revisión.
- IMPORTANTE: el contrato/buscador dirigido ya está codificado, pero el motor visual/IA que lee el binario de JPG/PNG/WEBP/PDF todavía NO está conectado. El input de archivo se muestra como preparación y no debe anunciarse como lectura automática activa hasta conectar el proveedor existente o uno autorizado.
- No se inventó una API/clave de IA y no se agregó variable Vercel.
- Siguiente paso exacto: localizar/conectar el lector real reutilizable de Rendiciones (si existe en la rama/base efectiva) o definir proveedor autorizado; luego almacenar original privado y poblar extracted_data antes de la confirmación.
- Validación requerida: Preview Vercel + TypeScript/build.


## Hotfix Flota · error 1234292577 en Documentos · 2026-09-23
- Confirmado en Runtime Vercel: POST /flota/[id] devolvía 500 con digest 1234292577 al guardar documento.
- Causa: constraint legado fleet_documents_kind_check solo aceptaba Seguro/Revisión técnica/Permiso de circulación/Mantención, mientras la UI nueva guarda PADRON/REVISION_TECNICA/PERMISO_CIRCULACION/SOAP/SEGURO_AUTOMOTRIZ/MANTENCION/OTRO.
- Aplicada migración flota_document_kinds_v2 para alinear el constraint con el expediente documental actual.
- Alineado también FleetDocumentKind en domain.ts.
- No se modificaron Materiales/Bodega/Rendiciones.
- Pendiente inmediato: implementar flujo fotográfico 7/7 real para toma/devolución, cámara móvil con capture=environment, guía gráfica por posición y almacenamiento de originales; todavía NO está implementado y no debe simularse.
- Pendiente lector documental: contrato dirigido listo, motor visual binario aún sin proveedor conectado.
- Validación: repetir guardado de documento en Preview y revisar siguiente deployment.


## Flota · cámara guiada 7/7 activa · 2026-09-23
- Se integró cámara web real en Tomar/Devolver vehículo mediante getUserMedia, priorizando cámara trasera (facingMode environment).
- La inspección exige 7 posiciones antes de habilitar confirmación: Frontal, Trasera, Lateral izquierdo, Lateral derecho, Tablero, Interior 1 e Interior 2.
- Las referencias originales entregadas por el usuario para frontal/trasera/lateral se incorporaron como guías visuales dentro de la cámara; lateral derecho reutiliza la referencia invertida.
- La guía se superpone semitransparente sobre video en vivo, pero NO se incrusta en la fotografía guardada. La evidencia almacenada es la captura limpia.
- Cada posición se abre tocando su propia tarjeta/figura; no se presenta “Cargar archivo” como flujo operativo.
- Creado bucket privado fleet-photos, máximo 8 MB por imagen, con acceso condicionado a has_additional_service_access('flota').
- Toma y devolución almacenan las 7 evidencias en fleet_photos y Storage asociadas al uso.
- El botón Confirmar permanece deshabilitado hasta 7/7.
- Se incorporó manejo idempotente en el flujo nuevo: si el vehículo ya no está Disponible o el uso ya fue devuelto, vuelve a la ficha en vez de provocar el 500 observado por doble envío.
- Tablero/Interior todavía usan guía neutra porque el usuario no ha entregado imágenes originales para esas tres posiciones; no se inventaron gráficos.
- Validación pendiente: deployment Preview del commit más reciente, permiso de cámara en Android/Chrome, captura 7/7, persistencia Storage/DB y devolución 7/7.
- No se agregaron variables Vercel. Materiales/Bodega/Rendiciones no fueron modificados.


## Flota · guías por vehículo en cámara · 2026-09-23
- Rama de tarea: feature/flota-siluetas-modelos, creada desde feature/flota-base; main/Production no se tocaron.
- FleetInspectionCamera ahora recibe la patente y selecciona una silueta distinta según los cinco vehículos cargados: LKDG49 SUV/Ford Escape, RBHJ56 hatch/MG 3, SRYB45 pickup/JAC T8, SPZJ40 van/Opel Vivaro y TTHG24 van/Opel Combo.
- Frontal, trasera, lateral izquierdo y lateral derecho se dibujan como guías vectoriales dentro de la cámara; la guía no se incrusta en la evidencia.
- Tablero mantiene captura obligatoria y ahora muestra instrucción específica para encuadrar tablero completo y dejar visible el odómetro.
- IMPORTANTE: lectura automática del odómetro todavía NO está conectada a un motor visual. La foto del tablero se almacena como evidencia y la UI lo declara explícitamente; no se inventan lecturas.
- Las 25 siluetas PNG extraídas de la lámina original siguen disponibles como material preparado, pero no se publicaron como binarios en GitHub en este cambio; para evitar mantener la vista anterior, la app usa guías vectoriales específicas por tipo/patente en código.
- Siguiente validación: Preview Vercel de esta rama; probar Android/Chrome: abrir cámara desde cada tarjeta, overlay correcto por patente, captura 7/7 y persistencia.
- Variables Vercel: ninguna nueva.


## Flota · guía exterior única estandarizada a furgón · 2026-09-23
- Decisión del dueño: dejar de variar la silueta exterior por patente/modelo. Se usa una única guía estándar tipo furgón para TODOS los vehículos.
- Frontal, Trasera, Lateral izquierdo y Lateral derecho usan el mismo lenguaje gráfico de furgón; lateral derecho es la orientación inversa de la misma guía.
- La misma guía se muestra en la tarjeta y superpuesta dentro de la cámara. No se incrusta en la fotografía guardada.
- Se eliminó de FleetInspectionCamera la selección BODY por LKDG49/RBHJ56/SRYB45/SPZJ40/TTHG24 para evitar que vuelva a aparecer un automóvil genérico distinto.
- Se corrigió además el desborde visual de Tablero, Interior 1 e Interior 2 dentro de sus tarjetas.
- La lectura automática del odómetro sigue pendiente de motor visual real; esta corrección no simula lectura.
- Validación pendiente: Preview Vercel READY de los commits 344e4fde y 0cb5e2c8, prueba visual escritorio + Android y apertura de cámara.
- Variables Vercel: ninguna nueva.


## Flota · guía gráfica lateral incorporada físicamente a la app · 2026-09-23
- Se incorporó al repositorio la imagen line-art solicitada para la cámara: public/flota/guias/pickup-lateral-izquierda.svg, optimizada para uso web.
- FleetInspectionCamera dejó de dibujar el lateral mediante SVG genérico en código y ahora carga este activo gráfico real.
- Lateral izquierdo usa el activo directamente; lateral derecho reutiliza el mismo activo invertido horizontalmente para mantener un estándar único.
- La misma imagen se muestra en la tarjeta 7/7 y como overlay semitransparente sobre la cámara en vivo.
- La guía visual no se incrusta en la fotografía capturada; la evidencia continúa guardándose limpia.
- Frontal/trasera permanecen con la guía vectorial actual hasta disponer/incorporar sus activos gráficos equivalentes.
- Lectura automática de odómetro/tacómetro sigue pendiente de motor visual real.
- Validación pendiente: Vercel Preview READY del commit 8a5a71bd y prueba Android/Chrome.
- Variables Vercel: ninguna nueva.


## Flota · retiro de guías superpuestas en cámara · 2026-09-23
- Por decisión del dueño se eliminaron las guías visuales superpuestas dentro de la cámara de inspección.
- La cámara ahora muestra la imagen en vivo sin silueta ni marco de alineación; conserva únicamente la instrucción breve para encuadrar el vehículo o el tablero.
- Se mantienen las 7 posiciones obligatorias y la captura/persistencia de fotografías.
- Las referencias visuales de las tarjetas de inspección no se eliminaron en este cambio; el retiro solicitado aplica a la cámara.
- No se modificó Supabase ni Materiales.
- Validación pendiente: Preview Vercel y prueba de apertura/captura en Android.
- Variables Vercel: ninguna nueva.


## Flota · fotografías maestras cargadas en perfiles · 2026-09-23
- Se incorporó public/flota/fleet-profiles.webp, optimizado desde la fotografía entregada por el dueño.
- Se asignó cover_photo_path=/flota/fleet-profiles.webp a LKDG49, RBHJ56, SRYB45, SPZJ40 y TTHG24.
- La pantalla principal de Flota recorta el activo por patente para mostrar a cada vehículo con su fotografía correspondiente.
- Estas son fotografías maestras de perfil: las fotos 7/7 de inspección NO reemplazan automáticamente la portada.
- No se alteró Materiales ni el flujo de toma/devolución.
- Validación pendiente: Preview Vercel y revisión visual de los cinco recortes en escritorio/Android.
- Variables Vercel: ninguna nueva.


## Flota · láminas 7/7 estandarizadas para todos los vehículos · 2026-09-23
- Se aplicó una única familia gráfica limpia a TODOS los vehículos de Flota, sin depender de patente/modelo.
- Las siete tarjetas usan line-art uniforme: Frontal, Trasera, Lateral izquierdo, Lateral derecho, Tablero, Interior 1 e Interior 2.
- Se retiraron de las tarjetas los placeholders de texto ODO y los rombos simples de interiores; ahora Tablero e interiores tienen dibujo lineal completo.
- La cámara sigue SIN guía superpuesta, según decisión anterior; las láminas solo sirven para elegir la fotografía antes de abrir la cámara.
- Las 7 fotografías continúan siendo obligatorias y se guardan como evidencia limpia.
- No se modificó Supabase, Materiales ni reglas de toma/devolución.
- Validación pendiente: Preview Vercel y prueba visual escritorio/Android.
- Variables Vercel: ninguna nueva.


## Flota · corrección fotografías de perfiles y láminas · 2026-09-23
- Se corrigió el recorte del atlas fotográfico maestro: 3 vehículos en fila superior y 2 en fila inferior.
- El expediente individual ahora muestra explícitamente la fotografía maestra del vehículo, además de patente, identificación y estado.
- Las fotografías de inspección 7/7 continúan separadas y no reemplazan la portada.
- Se mantiene la familia de siete láminas line-art limpia para Frontal, Trasera, Lateral izquierdo, Lateral derecho, Tablero, Interior 1 e Interior 2 en todos los vehículos.
- Se corrigió el texto que todavía indicaba alinear con una guía; la cámara permanece limpia, sin overlay.
- Validación pendiente: nuevo Preview Vercel, comprobar fotografías en listado y expediente individual y las 7 tarjetas en Android.
- Variables Vercel: ninguna nueva.


## Auditoría funcional Flota y plan por tandas de 3 · 2026-09-23
- Criterio corregido: una función NO se considera operativa solo porque exista tabla/código; debe completar UI → servidor → Storage/DB → lectura visible posterior.
- Foto maestra por vehículo: FALLA funcional. Los 5 vehículos apuntan al atlas local /flota/fleet-profiles.webp, pero la presentación en perfiles no está validada/visible correctamente.
- Inspección 7/7: PARCIAL, no cerrada. En SRYB45 existen 14 archivos reales en fleet-photos (7 Toma + 7 Devolución) y 14 filas fleet_photos; dos usos previos de RBHJ56 tienen 0 fotos. Además la UI no expone una galería/historial de evidencias, por lo que para el usuario aparenta no guardar. Se considera FALLA operacional hasta que captura, persistencia y consulta visible estén verificadas extremo a extremo.
- Documentos: FALLA. fleet_documents registra metadatos, pero document_file no se sube a Storage y no existe circuito Ver archivo.
- Combustible, mantenciones, deterioros y ubicaciones: tablas preparadas, pero 0 registros y sin circuito UI completo; NO activos.
- Lector documental y lector de tablero/odómetro: diseño/plantillas preparadas, motor visual NO conectado.
- Historial: parcial; muestra asignaciones/mantenciones/deterioros, pero no expone fotos, documentos, combustible ni ubicaciones.
- Método acordado: trabajar en tandas estrictas de 3 correcciones, validar Preview/Android y persistencia real antes de iniciar la siguiente tanda.
- Tanda 1 propuesta: (1) foto maestra visible por vehículo, (2) 7/7 guardar + galería visible Toma/Devolución, (3) documentos subir/guardar/ver archivo.
- Tanda 2: (1) odómetro/tablero con confirmación humana, (2) GPS puntual Toma/Devolución, (3) historial unificado visible.
- Tanda 3: (1) mantenciones, (2) combustible, (3) deterioro/comparación.
- Tanda 4: (1) alertas configurables, (2) notificaciones por rol, (3) reporte mensual.
- No avanzar de tanda mientras cualquiera de sus 3 circuitos no esté probado extremo a extremo.
- Variables Vercel: por definir solo cuando se conecte el motor visual; no inventar proveedor/API.


## Rutas · Supervisora no podía iniciar ruta · 2026-09-23
- Falla confirmada: el botón Iniciar ruta sí llamaba startDeliveryRoute, pero este intentaba mover cada despacho mediante transition_dispatch_v1; esa RPC solo autorizaba Admin Total/Admin/Bodega y rechazaba a Supervisora.
- La fecha NO era la causa. Ruta de prueba p3 estaba planificada 2026-09-23, estado Preparada, asignada a Supervisor (rol Supervisora), con 2 despachos En preparación.
- Corrección DB aplicada: migración fix_supervisora_start_assigned_route_v1 crea RPC transaccional start_delivery_route_v1(uuid).
- Seguridad: Supervisora solo puede iniciar una ruta si es exactamente delivery_assignee_id. No se amplió su permiso general sobre despachos ajenos.
- La RPC mueve de forma atómica los despachos En preparación → Listo para despacho → En tránsito, registra movimientos de inventario/auditoría y finalmente cambia la ruta a En tránsito. Si falla cualquier paso, la transacción revierte completa.
- route-actions.ts ahora usa start_delivery_route_v1 en vez de encadenar transition_dispatch_v1 desde el cliente servidor.
- Commit de código: bf062ac7697c7cfe3cfde166f400656d952d2bb5.
- Validación manual pendiente: entrar como Supervisora asignada, abrir p3, pulsar Iniciar ruta y comprobar ruta + 2 guías En tránsito después de recargar.
- Variables Vercel: ninguna nueva.


## Flota · Tanda 1.3 expediente documental y lector conectado · 2026-09-25
- **Rama de tarea:** `fix/flota-documentos-lector-expediente`, creada desde `feature/flota-siluetas-modelos` en SHA de restauración `3abe09dc5d9103baa032c064dc82a88480f89187`. `main` y Production no se tocaron.
- **Diagnóstico confirmado:** Flota tenía plantillas en `src/modules/flota/document-reader.ts`, pero no existía endpoint visual ni persistencia del archivo seleccionado. `saveFleetDocument` ignoraba `document_file`.
- **Corrección implementada:** endpoint `/api/flota/leer-documento` reutiliza la estrategia Gemini → OpenRouter ya existente en Rendiciones; PDF se envía a Gemini y el respaldo OpenRouter se limita a imágenes.
- **Archivo original:** se guarda en bucket privado existente `fleet-documents` (PDF/JPG/PNG/WEBP, máximo 10 MB), registrando `storage_path` y `source_file_name`. La UI genera URL firmada temporal para abrir el original.
- **Lista documental:** Documentos registrados queda como lista compacta. El nombre abre el detalle individual; `Abrir original` abre el PDF/imagen del mismo registro. Las renovaciones mantienen versiones anteriores.
- **Campos por tipo:** la interfaz usa `FLEET_DOCUMENT_TEMPLATES`; no muestra un formulario único de seguro para todos los documentos. La lectura solo propone datos y exige confirmación humana.
- **Semáforo base:** documentos: amarillo desde 20 días y rojo desde 5 días/vencido. Cambio de aceite: amarillo desde 750 km y rojo desde 250 km o sobrepasado.
- **Base de datos verificada antes de cambiar:** `fleet_documents` ya contiene `storage_path`, `source_file_name`, `extracted_data`, `confirmed_data`, `reader_status`, vigencias y versiones. El bucket privado `fleet-documents` ya existe. **No se realizó cambio de esquema Supabase.**
- **Pendiente siguiente:** alertas automáticas por correo con idempotencia para documentos 20/15/10/5 días y aceite 750/500/250 km, propagación del peor semáforo al listado general de vehículos, y validación E2E en Preview/Android.
- **Variables:** el lector existente requiere `GEMINI_API_KEY` y opcionalmente `GEMINI_RECEIPT_MODEL`; respaldo de imágenes usa `OPENROUTER_API_KEY`. Verificar su presencia en Preview antes de prueba real; no inventar claves.


## Flota · corrección kilometraje ficha principal · 2026-09-25
- **Rama:** `fix/flota-resumen-km-datos-confirmados`, creada desde `fix/flota-documentos-lector-expediente` SHA `1f7a8cf835fd219e3a25eff41ba9632016051cc6`.
- **Punto de restauración:** SHA base `1f7a8cf835fd219e3a25eff41ba9632016051cc6`.
- Se verificó la fuente real antes de modificar: `fleet_vehicles.current_km` conserva el kilometraje operacional y el Cambio de aceite confirmado guarda `confirmed_data.next_service_km`.
- La ficha principal ahora obtiene el próximo cambio de aceite desde el documento `MANTENCION` vigente y confirmado; solo usa `fleet_vehicles.next_oil_change_km` como respaldo cuando no existe dato documental válido.
- Caso real verificado SPZJ40: kilometraje actual 156.332 km; Cambio de aceite confirmado a 150.648 km; próximo servicio confirmado 160.648 km. La ficha debe mostrar 4.316 km restantes.
- No se modificó esquema Supabase, registros existentes, captura 7/7, documentos ni Production/main.
- **Pendiente de validación:** Preview, `npm run build` y `npx tsc --noEmit`.
- **Variables Vercel:** ninguna nueva para esta corrección.


## Flota · recuperación registro fotográfico 7/7 · 2026-09-25
- **Rama:** `fix/flota-recuperar-registro-fotografico`, creada desde `fix/flota-resumen-km-datos-confirmados` SHA `7a52b8212f8bc7675078cbb37017c6d826b1d32e`.
- **Punto de restauración:** SHA base `7a52b8212f8bc7675078cbb37017c6d826b1d32e`.
- Se verificó antes de modificar que los registros fotográficos NO se perdieron: SPZJ40 conserva 7 fotos de Toma y SRYB45 conserva 14 fotos, 7 de Toma + 7 de Devolución, vinculadas a sus assignment_id.
- La vista Historial consulta `fleet_photos`, genera URLs temporales privadas desde `fleet-photos` y agrupa las evidencias por uso y fase.
- Cada uso muestra contador de fotos y galerías Toma/Devolución en el orden Frontal, Trasera, Lateral izquierdo, Lateral derecho, Tablero, Interior 1, Interior 2.
- Las miniaturas abren la evidencia original mediante URL firmada temporal; no se hace público el bucket.
- No se modificó esquema Supabase, no se copiaron ni eliminaron fotografías y no se tocó main/Production.
- **Pendiente de validación:** Preview, apertura de las 14 fotos SRYB45, 7 fotos SPZJ40, `npm run build` y `npx tsc --noEmit`.
- **Variables Vercel:** ninguna nueva.


## Flota · detalle de atenciones documentales · 2026-09-25
- **Rama:** `fix/flota-atenciones-documentales`, creada desde `fix/flota-recuperar-registro-fotografico` SHA `d4dff6a04cf3bf78ae988ab57947c8b110b10220`.
- **Punto de restauración:** SHA base `d4dff6a04cf3bf78ae988ab57947c8b110b10220`.
- La tarjeta Atenciones deja de contar como vencimiento los documentos que legítimamente no tienen `expires_at` (por ejemplo Padrón y Cambio de aceite).
- Solo se consideran alertas documentales los documentos vigentes con fecha de expiración y estado warning/critical según la regla existente.
- El contador de documentos es desplegable: al pulsarlo muestra tipo, fecha de vencimiento y estado; cada fila navega al expediente documental del mismo vehículo.
- Verificación de datos SPZJ40: Permiso y SOAP vencen 31-03-2027; Revisión técnica 28-02-2028; Padrón y Cambio de aceite no tienen vencimiento documental. Con la fecha actual 25-09-2026 ninguno corresponde a vencimiento próximo según la regla vigente.
- No se modificó esquema Supabase, datos, reglas de kilometraje, fotos ni main/Production.
- **Pendiente:** validar Preview, build y tsc.
- **Variables Vercel:** ninguna nueva.


## Flota · etiquetas documentales en español · 2026-09-25
- **Rama:** `fix/flota-documentos-espanol`, creada desde `fix/flota-atenciones-documentales` SHA `4e1e9bf48af9fa79a89e2c9a23b7c81e6739b56a`.
- **Punto de restauración:** SHA base `4e1e9bf48af9fa79a89e2c9a23b7c81e6739b56a`.
- El detalle documental mantiene las claves técnicas internas para compatibilidad, pero nunca las expone como etiquetas al usuario.
- Se traducen VIN/Chasis, Año, Marca, Color, Modelo, Propietario, Patente, Motor, Fecha de emisión, RUT propietario, Vigente desde, Vencimiento, Tipo de vehículo y campos de revisión, permiso, seguros y Cambio de aceite.
- No se modifican datos existentes, lector, esquema Supabase ni main/Production.
- **Pendiente:** validar Preview, build y tsc.
- **Variables Vercel:** ninguna nueva.


## Flota · presentación íntegra en español y hora Chile continental · 2026-09-25
- **Rama:** `fix/flota-presentacion-es-cl`, creada desde `fix/flota-documentos-espanol` SHA `515fe0e8bb5e3ef082fab7abb43baa105903cdb4`.
- **Punto de restauración:** SHA base `515fe0e8bb5e3ef082fab7abb43baa105903cdb4`.
- Cambio exclusivamente de presentación: las claves internas, IDs, nombres de columnas y contratos del código permanecen intactos.
- El detalle documental ya no expone claves técnicas desconocidas en inglés; los campos conocidos usan etiqueta española y cualquier campo no catalogado se presenta como “Dato del documento”.
- Fechas/horas visibles del expediente usan explícitamente `America/Santiago` con formato `es-CL`, respetando automáticamente horario de verano/invierno de Chile continental.
- No se alteran timestamps almacenados, fechas documentales, datos existentes ni fecha actual del sistema.
- No se modificó esquema Supabase, lector documental, reglas de negocio ni main/Production.
- **Pendiente:** validar Preview, build y tsc.
- **Variables Vercel:** ninguna nueva.

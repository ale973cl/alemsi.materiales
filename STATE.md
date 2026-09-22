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

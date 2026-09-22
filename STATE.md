# STATE — ALEMSI Materiales
## Estado actual
- **Rama activa:** ui/rendiciones-corporativa
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

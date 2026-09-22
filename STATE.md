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
